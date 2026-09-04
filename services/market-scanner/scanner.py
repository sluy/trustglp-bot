import asyncio
import json
import logging
from binance_p2p import fetch_p2p_ads, parse_ad_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def calculate_maker_spread(buy_ads_from_takers, sell_ads_from_takers):
    """
    Calcula el spread real evaluando los top 5 anuncios competidores desde la perspectiva de un MAKER.
    - sell_ads_from_takers (Rojos en Binance): Anuncios de Takers VENDIENDO. Nosotros como MAKER competimos
      poniendo un anuncio de COMPRA para quitarles este flujo.
    - buy_ads_from_takers (Verdes en Binance): Anuncios de Takers COMPRANDO. Nosotros como MAKER competimos
      poniendo un anuncio de VENTA para quitarles este flujo.
      
    Fórmula Maker: Rentabilidad = (Precio Venta Maker - Precio Compra Maker) / Precio Compra Maker
    """
    if not buy_ads_from_takers or not isinstance(buy_ads_from_takers, list) or not sell_ads_from_takers or not isinstance(sell_ads_from_takers, list):
        return None
    
    # Tomar el top 3 para mayor precisión en la primera página
    # Maker Sell (Verdes): Si el mejor Taker ofrece comprar a 40 Bs, nosotros podemos vender a ~40 Bs
    valid_buy_ads: list[float] = []
    for ad in buy_ads_from_takers:
        if isinstance(ad, dict) and 'price' in ad:
            try:
                valid_buy_ads.append(float(ad['price']))
            except (ValueError, TypeError):
                pass
                
    valid_sell_ads: list[float] = []
    for ad in sell_ads_from_takers:
        if isinstance(ad, dict) and 'price' in ad:
            try:
                valid_sell_ads.append(float(ad['price']))
            except (ValueError, TypeError):
                pass

    sorted_buys = sorted(valid_buy_ads, reverse=True)
    sorted_sells = sorted(valid_sell_ads)
    
    top_maker_sell_prices = sorted_buys[:3] if len(sorted_buys) > 0 else []
    top_maker_buy_prices = sorted_sells[:3] if len(sorted_sells) > 0 else []

    avg_maker_sell = sum(top_maker_sell_prices) / len(top_maker_sell_prices) if top_maker_sell_prices else 0
    avg_maker_buy = sum(top_maker_buy_prices) / len(top_maker_buy_prices) if top_maker_buy_prices else 0

    spread_abs = avg_maker_sell - avg_maker_buy
    spread_gross_pct = (spread_abs / avg_maker_buy * 100) if avg_maker_buy > 0 else 0
    
    # Comisiones de Binance P2P para Makers (0.125% por Crear anuncio Venta + 0.125% por Crear anuncio Compra) = 0.25% total
    maker_fee_total_pct = 0.25
    spread_net_pct = spread_gross_pct - maker_fee_total_pct

    return {
        "avg_buy_price": avg_maker_buy,
        "avg_sell_price": avg_maker_sell,
        "spread_abs": spread_abs,
        "spread_pct": spread_net_pct,
        "spread_gross_pct": spread_gross_pct,
        "top_competitor_buy": top_maker_buy_prices[0] if top_maker_buy_prices else 0,
        "top_competitor_sell": top_maker_sell_prices[0] if top_maker_sell_prices else 0
    }

async def market_scanner_worker(redis_client):
    """
    Bucle en segundo plano que extrae datos de Binance constantemente,
    calcula la rentabilidad y empuja esa telemetría al bus de Redis.
    """
    logger.info("Market Scanner Worker Iniciado.")
    CHANNEL_NAME = "market_updates:usdt_ves"

    CAPITAL_BASE_USDT = 2000
    
    # Para el primer barrido, usamos un tipo de cambio simulado grueso (ej, 40 VES/USDT) para forzar a Binance
    # a solo enviarnos comerciantes capaces de mover ~40.000 VES de una vez.
    ESTIMATED_RATE_VES = 40.0 
    SIMULATED_TRANS_AMOUNT = CAPITAL_BASE_USDT * ESTIMATED_RATE_VES

    while True:
        try:
            logger.info(f"Extrayendo libro de órdenes USDT/VES para capital sim: {CAPITAL_BASE_USDT} USDT (Aprox. {SIMULATED_TRANS_AMOUNT:,.2f} VES)...")
            
            # 1. Extracción paralela Inyectando Monto Fiduciario (transAmount)
            raw_buy_takers, raw_sell_takers = await asyncio.gather(
                fetch_p2p_ads(trade_type="BUY", asset="USDT", fiat="VES", trans_amount=SIMULATED_TRANS_AMOUNT),
                fetch_p2p_ads(trade_type="SELL", asset="USDT", fiat="VES", trans_amount=SIMULATED_TRANS_AMOUNT)
            )

            parsed_buy = parse_ad_data(raw_buy_takers)
            parsed_sell = parse_ad_data(raw_sell_takers)

            # 2. Análisis Dinámico (Maker Spread)
            metrics_co = await calculate_maker_spread(parsed_buy, parsed_sell)
            metrics: dict[str, float] = metrics_co if metrics_co else {}
            
            # Ajuste en tiempo real de la tasa estimada para el próximo loop según el mercado real
            if metrics and metrics.get("avg_buy_price", 0) > 0:
                 ESTIMATED_RATE_VES = float(metrics["avg_buy_price"])
                 SIMULATED_TRANS_AMOUNT = float(CAPITAL_BASE_USDT * ESTIMATED_RATE_VES)
            
            if metrics:
                payload = {
                    "asset": "USDT",
                    "fiat": "VES",
                    "metrics": metrics,
                    "competitors_snapshot": {
                        "buy_orders_count": len(parsed_buy),
                        "sell_orders_count": len(parsed_sell)
                    }
                }
                
                # 3. Publicación (Redis Pub/Sub)
                await redis_client.publish(CHANNEL_NAME, json.dumps(payload))
                spread_val = metrics.get('spread_pct', 0)
                logger.info(f"Telemetría publicada con éxito. Spread: {float(spread_val):.2f}%")
            
            # Pausa de seguridad para evitar Rate Limiting (ej. 15 segundos)
            await asyncio.sleep(15)

        except asyncio.CancelledError:
            logger.info("Worker cancelado.")
            break
        except Exception as e:
            logger.error(f"Error en worker loop: {e}")
            await asyncio.sleep(30)


from bybit_p2p import fetch_bybit_p2p_ads, parse_bybit_ad_data

async def bybit_combinatorial_spread(buy_competitors: dict, sell_competitors: dict, min_vital_spread_pct: float = 1.0):
    OUTLIER_THRESHOLD_PCT = 0.3 # 0.3% diferencia para considerar un ad como outlier troll
    best_buys = {}
    for tier_key, item in buy_competitors.items():
        ads = item["data"]
        valid = [float(ad['price']) for ad in ads if 'price' in ad]
        if valid:
            sorted_buys = sorted(valid, reverse=True)
            top_competitor = sorted_buys[0]
            # Capa 1: Outlier Detection (Compra: tiran el precio artificialmente arriba)
            if len(sorted_buys) > 1:
                diff_pct = (sorted_buys[0] - sorted_buys[1]) / sorted_buys[1] * 100
                if diff_pct > OUTLIER_THRESHOLD_PCT:
                    top_competitor = sorted_buys[1]
            best_buys[tier_key] = {"price": top_competitor, "val": item["val"]}
            
    best_sells = {}
    for tier_key, item in sell_competitors.items():
        ads = item["data"]
        valid = [float(ad['price']) for ad in ads if 'price' in ad]
        if valid:
            sorted_sells = sorted(valid)
            top_competitor = sorted_sells[0]
            # Capa 1: Outlier Detection (Venta: tiran el precio artificialmente abajo)
            if len(sorted_sells) > 1:
                diff_pct = (sorted_sells[1] - sorted_sells[0]) / sorted_sells[0] * 100
                if diff_pct > OUTLIER_THRESHOLD_PCT:
                    top_competitor = sorted_sells[1]
            best_sells[tier_key] = {"price": top_competitor, "val": item["val"]}

    strategies = []
    
    for sell_tier_key, sell_comp in best_sells.items():
        for buy_tier_key, buy_comp in best_buys.items():
            sell_comp_price = sell_comp["price"]
            buy_comp_price = buy_comp["price"]
            
            # Nuestros precios teóricos como Maker #1
            our_sell_price = sell_comp_price - 0.01
            raw_our_buy_price = buy_comp_price + 0.01
            
            # Capa 2: Dynamic Spread Cap
            max_allowed_buy_price = our_sell_price * (1 - (min_vital_spread_pct / 100.0))
            
            if raw_our_buy_price > max_allowed_buy_price:
                # Clamp the buy price. Protect profitability against spoofing/trolls.
                our_buy_price = max_allowed_buy_price
            else:
                our_buy_price = raw_our_buy_price
                
            our_buy_price = round(our_buy_price, 2)
            our_sell_price = round(our_sell_price, 2)
            
            spread_abs = our_sell_price - our_buy_price
            spread_gross_pct = (spread_abs / our_buy_price) * 100 if our_buy_price > 0 else 0
            spread_net_pct = spread_gross_pct - 0.0 # 0.0% Maker Fee en Bybit P2P (VES)
            
            strategies.append({
                "strategy_id": f"{sell_tier_key}_{buy_tier_key}",
                "sell_tier_ves": sell_comp["val"],
                "buy_tier_ves": buy_comp["val"],
                "our_sell_price": our_sell_price,
                "our_buy_price": our_buy_price,
                "spread_net_pct": spread_net_pct,
                "spread_gross_pct": spread_gross_pct,
                "bot_sell_target": sell_comp_price,
                "bot_buy_target": buy_comp_price,
                "is_buy_capped": raw_our_buy_price > max_allowed_buy_price
            })
            
    strategies.sort(key=lambda x: x['spread_net_pct'], reverse=True)
    return strategies[:3]

async def bybit_market_scanner_worker(redis_client):
    logger.info("Bybit Market Scanner Worker Iniciado (Banesco & Mercantil).")
    CHANNEL_NAME = "market_updates:bybit_usdt_ves"

    ESTIMATED_RATE_VES = 630.0

    while True:
        try:
            capital_str = await redis_client.get("bybit_p2p_operative_capital_usdt")
            try:
                max_capital_usdt = float(str(capital_str).replace(',', '.')) if capital_str and capital_str != 'null' else 500.0
            except ValueError:
                max_capital_usdt = 500.0
            
            spread_str = await redis_client.get("bybit_p2p_min_vital_spread_pct")
            try:
                min_vital_spread_pct = float(str(spread_str).replace(',', '.')) if spread_str and spread_str != 'null' else 1.0
            except ValueError:
                min_vital_spread_pct = 1.0
            
            total_fiat = max_capital_usdt * ESTIMATED_RATE_VES
            
            SELL_USDT_TIERS_VALUES = [total_fiat * 1.0, total_fiat * 0.50, total_fiat * 0.15]
            BUY_USDT_TIERS_VALUES  = [total_fiat * 0.25, total_fiat * 0.15, total_fiat * 0.05]
            
            SELL_KEYS = ["sell_tier_1", "sell_tier_2", "sell_tier_3"]
            BUY_KEYS = ["buy_tier_1", "buy_tier_2", "buy_tier_3"]

            logger.info(f"Escaneando Bybit Matrix | Capital: {max_capital_usdt} USDT | Rate ref: {ESTIMATED_RATE_VES}")
            
            # --- EVALUACIÓN BANESCO (Combinatorio) ---
            sell_tasks_banesco = [fetch_bybit_p2p_ads(trade_type="BUY", asset="USDT", fiat="VES", trans_amount=t, rows=20) for t in SELL_USDT_TIERS_VALUES]
            buy_tasks_banesco = [fetch_bybit_p2p_ads(trade_type="SELL", asset="USDT", fiat="VES", trans_amount=t, rows=20) for t in BUY_USDT_TIERS_VALUES]

            all_results_banesco = await asyncio.gather(*(sell_tasks_banesco + buy_tasks_banesco))
            sell_results_banesco = all_results_banesco[:len(SELL_USDT_TIERS_VALUES)]
            buy_results_banesco = all_results_banesco[len(SELL_USDT_TIERS_VALUES):]
            
            sell_competitors_banesco = {
                key: {"val": val, "data": parse_bybit_ad_data(res, bank_filter='banesco')} for key, val, res in zip(SELL_KEYS, SELL_USDT_TIERS_VALUES, sell_results_banesco)
            }
            buy_competitors_banesco = {
                key: {"val": val, "data": parse_bybit_ad_data(res, bank_filter='banesco')} for key, val, res in zip(BUY_KEYS, BUY_USDT_TIERS_VALUES, buy_results_banesco)
            }

            top_strategies_banesco = await bybit_combinatorial_spread(buy_competitors_banesco, sell_competitors_banesco, min_vital_spread_pct)
            
            if top_strategies_banesco:
                best_banesco = top_strategies_banesco[0]
                ESTIMATED_RATE_VES = best_banesco['bot_sell_target'] if best_banesco['bot_sell_target'] > 0 else ESTIMATED_RATE_VES
                
                payload_banesco = {
                    "exchange": "Bybit",
                    "asset": "USDT",
                    "fiat": "VES",
                    "bank": "Banesco",
                    "metrics": {
                        "spread_pct": best_banesco["spread_net_pct"],
                        "spread_gross_pct": best_banesco["spread_gross_pct"],
                        "top_competitor_sell": [s["our_sell_price"] for s in top_strategies_banesco],
                        "top_competitor_buy": [s["our_buy_price"] for s in top_strategies_banesco],
                    },
                    "top_strategies": top_strategies_banesco,
                    "combinatorial_mode": True
                }
                await redis_client.publish(CHANNEL_NAME, json.dumps(payload_banesco))
                logger.info(f"[BYBIT BANESCO] Yield Max: {best_banesco['spread_net_pct']:.2f}% | Vende {best_banesco['sell_tier_ves']/1000}k / Compra {best_banesco['buy_tier_ves']/1000}k")
                
            # Evitar Rate Limits
            await asyncio.sleep(2)
            
            # --- EVALUACIÓN MERCANTIL (Solo Compra Maker) ---
            # Compra Maker = Nosotros publicamos verde, por tanto buscamos competidores en la página de Venta Taker (SELLER ads en Bybit P2P Api)
            buy_tasks_mercantil = [fetch_bybit_p2p_ads(trade_type="SELL", asset="USDT", fiat="VES", trans_amount=t, rows=20) for t in BUY_USDT_TIERS_VALUES]
            buy_results_mercantil = await asyncio.gather(*buy_tasks_mercantil)
            
            buy_competitors_mercantil = {
                key: {"val": val, "data": parse_bybit_ad_data(res, bank_filter='mercantil')} for key, val, res in zip(BUY_KEYS, BUY_USDT_TIERS_VALUES, buy_results_mercantil)
            }
            
            top_strategies_mercantil = []
            for tier_key, item in buy_competitors_mercantil.items():
                ads = item["data"]
                valid = [float(ad['price']) for ad in ads if 'price' in ad]
                if valid:
                    sorted_buys = sorted(valid, reverse=True)
                    top_competitor = sorted_buys[0]
                    # Outlier Detection como en Combinatorial
                    if len(sorted_buys) > 1:
                        diff_pct = (sorted_buys[0] - sorted_buys[1]) / sorted_buys[1] * 100
                        if diff_pct > 0.3:
                            top_competitor = sorted_buys[1]
                    
                    # Nos posicionamos encima del top competitor (+0.01) para ganar el orderbook
                    our_buy_price = round(top_competitor + 0.01, 2)
                    top_strategies_mercantil.append({
                        "strategy_id": f"mercantil_buy_{tier_key}",
                        "buy_tier_ves": item["val"],
                        "sell_tier_ves": item["val"], # Dummy for compatibility
                        "our_buy_price": our_buy_price,
                        "our_sell_price": our_buy_price, # Dummy
                        "bot_buy_target": top_competitor,
                        "bot_sell_target": top_competitor, # Dummy
                        "spread_net_pct": 0.0, # N/A for strictly Buy
                        "spread_gross_pct": 0.0, # N/A for strictly Buy
                        "is_buy_capped": False
                    })
            
            if top_strategies_mercantil:
                 payload_mercantil = {
                     "exchange": "Bybit",
                     "asset": "USDT",
                     "fiat": "VES",
                     "bank": "Mercantil",
                     "metrics": {
                         "spread_pct": 0,
                         "spread_gross_pct": 0,
                         "top_competitor_sell": [],
                         "top_competitor_buy": [s["our_buy_price"] for s in top_strategies_mercantil],
                     },
                     "top_strategies": top_strategies_mercantil,
                     "combinatorial_mode": False
                 }
                 await redis_client.publish(CHANNEL_NAME, json.dumps(payload_mercantil))
                 logger.info(f"[BYBIT MERCANTIL] Buy Only Strategy | Compra target 1: {top_strategies_mercantil[0]['our_buy_price']}")

            # Evitar Rate Limits
            await asyncio.sleep(2)
            
            # --- EVALUACIÓN PAGO MÓVIL (Solo Compra Maker) ---
            buy_tasks_pagomovil = [fetch_bybit_p2p_ads(trade_type="SELL", asset="USDT", fiat="VES", trans_amount=t, rows=20) for t in BUY_USDT_TIERS_VALUES]
            buy_results_pagomovil = await asyncio.gather(*buy_tasks_pagomovil)
            
            buy_competitors_pagomovil = {
                key: {"val": val, "data": parse_bybit_ad_data(res, bank_filter='pagomovil')} for key, val, res in zip(BUY_KEYS, BUY_USDT_TIERS_VALUES, buy_results_pagomovil)
            }
            
            top_strategies_pagomovil = []
            for tier_key, item in buy_competitors_pagomovil.items():
                ads = item["data"]
                valid = [float(ad['price']) for ad in ads if 'price' in ad]
                if valid:
                    sorted_buys = sorted(valid, reverse=True)
                    top_competitor = sorted_buys[0]
                    # Outlier Detection
                    if len(sorted_buys) > 1:
                        diff_pct = (sorted_buys[0] - sorted_buys[1]) / sorted_buys[1] * 100
                        if diff_pct > 0.3:
                            top_competitor = sorted_buys[1]
                    
                    our_buy_price = round(top_competitor + 0.01, 2)
                    top_strategies_pagomovil.append({
                        "strategy_id": f"pagomovil_buy_{tier_key}",
                        "buy_tier_ves": item["val"],
                        "sell_tier_ves": item["val"], # Dummy for compatibility
                        "our_buy_price": our_buy_price,
                        "our_sell_price": our_buy_price, # Dummy
                        "bot_buy_target": top_competitor,
                        "bot_sell_target": top_competitor, # Dummy
                        "spread_net_pct": 0.0, # N/A for strictly Buy
                        "spread_gross_pct": 0.0, # N/A for strictly Buy
                        "is_buy_capped": False
                    })
            
            if top_strategies_pagomovil:
                 payload_pagomovil = {
                     "exchange": "Bybit",
                     "asset": "USDT",
                     "fiat": "VES",
                     "bank": "PagoMovil",
                     "metrics": {
                         "spread_pct": 0,
                         "spread_gross_pct": 0,
                         "top_competitor_sell": [],
                         "top_competitor_buy": [s["our_buy_price"] for s in top_strategies_pagomovil],
                     },
                     "top_strategies": top_strategies_pagomovil,
                     "combinatorial_mode": False
                 }
                 await redis_client.publish(CHANNEL_NAME, json.dumps(payload_pagomovil))
                 logger.info(f"[BYBIT PAGOMOVIL] Buy Only Strategy | Compra target 1: {top_strategies_pagomovil[0]['our_buy_price']}")

            await asyncio.sleep(15)

        except asyncio.CancelledError:
            logger.info("Bybit Worker cancelado.")
            break
        except Exception as e:
            logger.error(f"Error en Bybit worker: {e}")
            await asyncio.sleep(30)

