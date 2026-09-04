import axios from 'axios';
import crypto from 'crypto';

const apiKey = "HPX0pcKzJqW083RVV5";
const apiSecret = "GXam2dGdBbZIkom3q6BF274X0ApRimcEJAjU";

function generateSignature(params: string, timestamp: string, recvWindow: string): string {
    return crypto.createHmac('sha256', apiSecret).update(timestamp + apiKey + recvWindow + params).digest('hex');
}

async function getOrders() {
    const timestamp = Date.now().toString();
    const recvWindow = '50000';
    const params = 'size=20';
    const signature = generateSignature(params, timestamp, recvWindow);

    try {
        const response = await axios.get(`https://api.bybit.com/v5/p2p/order/pending/simplifyList?${params}`, {
            headers: {
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-RECV-WINDOW': recvWindow,
                'X-BAPI-SIGN': signature,
            }
        });
        console.log("BYBIT SimplifyList Response:");
        console.log(JSON.stringify(response.data.result.list, null, 2));
    } catch (e: any) {
        console.error(e.message);
    }
}

getOrders();
