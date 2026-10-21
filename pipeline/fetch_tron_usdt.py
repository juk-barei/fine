import requests
import json
import time
from datetime import datetime, timezone
from typing import List, Dict, Any

# Official TRC-20 USDT Contract on Tron Mainnet
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
BASE_URL = "https://api.trongrid.io/v1/accounts/{address}/transactions/trc20"

def fetch_usdt_transfers(
    wallet_address: str, 
    limit: int = 50, 
    max_pages: int = 2,
    api_key: str = None
) -> List[Dict[str, Any]]:
    """
    Fetch TRC-20 USDT transfer events for a given Tron wallet address.
    """
    headers = {"User-Agent": "Mozilla/5.0"}
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key

    all_transfers = []
    fingerprint = None
    url = BASE_URL.format(address=wallet_address)

    print(f"Fetching USDT transfers for: {wallet_address} ...")

    for page in range(max_pages):
        params = {
            "contract_address": USDT_CONTRACT,
            "limit": limit,
            "order_by": "block_timestamp,desc"
        }
        if fingerprint:
            params["fingerprint"] = fingerprint

        try:
            res = requests.get(url, params=params, headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"Error {res.status_code}: {res.text}")
                break

            data = res.json()
            tx_list = data.get("data", [])
            if not tx_list:
                break

            for tx in tx_list:
                decimals = tx.get("token_info", {}).get("decimals", 6)
                raw_val = float(tx.get("value", 0))
                amount = raw_val / (10 ** decimals)
                ts_ms = tx.get("block_timestamp", 0)
                ts_sec = int(ts_ms / 1000)

                from_addr = tx.get("from")
                to_addr = tx.get("to")
                direction = "IN" if to_addr.lower() == wallet_address.lower() else "OUT"

                all_transfers.append({
                    "tx_hash": tx.get("transaction_id"),
                    "timestamp": ts_sec,
                    "datetime_utc": datetime.fromtimestamp(ts_sec, timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                    "from_address": from_addr,
                    "to_address": to_addr,
                    "amount": round(amount, 4),
                    "direction": direction
                })

            fingerprint = data.get("meta", {}).get("fingerprint")
            if not fingerprint:
                break

            time.sleep(0.2)  # courteous rate-limit delay
        except Exception as e:
            print(f"Exception while fetching: {e}")
            break

    return all_transfers


def extract_wallet_features(wallet_address: str, transfers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extracts high-level ML risk features from the transaction history.
    """
    if not transfers:
        return {"error": "No transactions found"}

    in_txs = [tx for tx in transfers if tx["direction"] == "IN"]
    out_txs = [tx for tx in transfers if tx["direction"] == "OUT"]

    total_in = sum(tx["amount"] for tx in in_txs)
    total_out = sum(tx["amount"] for tx in out_txs)
    
    unique_senders = len(set(tx["from_address"] for tx in in_txs))
    unique_recipients = len(set(tx["to_address"] for tx in out_txs))

    timestamps = sorted([tx["timestamp"] for tx in transfers])
    lifespan_hours = (timestamps[-1] - timestamps[0]) / 3600 if len(timestamps) > 1 else 0

    # Pass-through ratio: near 1.0 means almost all funds that enter are immediately dumped/forwarded
    pass_through_ratio = min(total_out / total_in, 1.0) if total_in > 0 else 0.0

    return {
        "wallet_address": wallet_address,
        "total_transactions": len(transfers),
        "in_count": len(in_txs),
        "out_count": len(out_txs),
        "total_usdt_received": round(total_in, 2),
        "total_usdt_sent": round(total_out, 2),
        "unique_senders": unique_senders,
        "unique_recipients": unique_recipients,
        "lifespan_hours": round(lifespan_hours, 2),
        "pass_through_ratio": round(pass_through_ratio, 4)
    }


if __name__ == "__main__":
    import sys

    # Default to an active Tron USDT wallet if none provided (e.g. Binance hot wallet or Tether Treasury)
    target_wallet = sys.argv[1] if len(sys.argv) > 1 else "TFa4XoHRNxkQx23SY5y9vPKBTX6bRN1pee"

    transfers = fetch_usdt_transfers(target_wallet, limit=5, max_pages=1)
    
    print("\n--- SAMPLE FORMATTED TRANSFERS ---")
    print(json.dumps(transfers[:], indent=2))

    print("\n--- EXTRACTED ML RISK FEATURES ---")
    features = extract_wallet_features(target_wallet, transfers)
    print(json.dumps(features, indent=2))
