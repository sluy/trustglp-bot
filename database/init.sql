-- init.sql: Script inicial de base de datos para Plataforma P2P

-- Crear esquema base
CREATE SCHEMA IF NOT EXISTS p2p;

-- Tabla: InventarioCapital
CREATE TABLE IF NOT EXISTS p2p.InventarioCapital (
    id SERIAL PRIMARY KEY,
    asset VARCHAR(10) NOT NULL,
    balance_available DECIMAL(18, 8) NOT NULL DEFAULT 0,
    balance_locked DECIMAL(18, 8) NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: AnunciosPropios
CREATE TABLE IF NOT EXISTS p2p.AnunciosPropios (
    ad_id VARCHAR(50) PRIMARY KEY,
    asset VARCHAR(10) NOT NULL,
    fiat VARCHAR(10) NOT NULL,
    trade_type VARCHAR(10) NOT NULL, -- BUY / SELL
    price DECIMAL(18, 8) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: TransaccionesEjecutadas
CREATE TABLE IF NOT EXISTS p2p.TransaccionesEjecutadas (
    order_id VARCHAR(50) PRIMARY KEY,
    ad_id VARCHAR(50) REFERENCES p2p.AnunciosPropios(ad_id),
    amount DECIMAL(18, 8) NOT NULL,
    total_price DECIMAL(18, 8) NOT NULL,
    counterparty VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
