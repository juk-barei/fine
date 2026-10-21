import requests
import hashlib
import time
import csv
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Set

USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
BASE_URL = f"https://api.trongrid.io/v1/contracts/{USDT_CONTRACT}/events"
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

def hex_to_tron_address(hex_str: str) -> str:
    """Converts a Tron/EVM hex address into standard Tron Base58 (T...) format."""
    hex_str = hex_str.replace('0x', '')
    addr_bytes = bytes.fromhex('41' + hex_str)
    checksum = hashlib.sha256(hashlib.sha256(addr_bytes).digest()).digest()[:4]
    
    n = int.from_bytes(addr_bytes + checksum, 'big')
    res = []
    while n > 0:
        n, r = divmod(n, 58)
        res.append(ALPHABET[r])
    pad = 0
    for b in addr_bytes + checksum:
        if b == 0: pad += 1
        else: break
    return '1' * pad + ''.join(reversed(res))

def get_blacklisted_addresses(target_count: int = 100, api_key: str = None) -> List[Dict[str, Any]]:
    """
    Crawls Tether USDT contract's AddedBlackList events to get real blacklisted Tron addresses.
    """
    headers = {"User-Agent": "Mozilla/5.0"}
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key

    blacklisted_records = []
    seen_addresses: Set[str] = set()
    fingerprint = None

    print(f"Fetching up to {target_count} blacklisted Tron addresses from Tether contract...")

    while len(blacklisted_records) < target_count:
        params = {
            "event_name": "AddedBlackList",
            "limit": min(50, target_count - len(blacklisted_records)),
            "order_by": "block_timestamp,desc"
        }
        if fingerprint:
            params["fingerprint"] = fingerprint

        try:
            res = requests.get(BASE_URL, params=params, headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"API Error {res.status_code}: {res.text}")
                break

            data = res.json()
            events = data.get("data", [])
            if not events:
                break

            for event in events:
                hex_user = event.get("result", {}).get("_user") or event.get("result", {}).get("0")
                if not hex_user:
                    continue

                tron_addr = hex_to_tron_address(hex_user)
                if tron_addr in seen_addresses:
                    continue
                seen_addresses.add(tron_addr)

                ts_ms = event.get("block_timestamp", 0)
                ts_sec = int(ts_ms / 1000)

                blacklisted_records.append({
                    "wallet_address": tron_addr,
                    "hex_address": hex_user,
                    "blacklisted_timestamp": ts_sec,
                    "blacklisted_utc": datetime.fromtimestamp(ts_sec, timezone.utc).strftime('%Y-%m-%d %H:%M:%S'),
                    "transaction_id": event.get("transaction_id"),
                    "label": 1  # 1 = High Risk / Blacklisted for ML training
                })

                if len(blacklisted_records) >= target_count:
                    break

            meta = data.get("meta", {})
            fingerprint = meta.get("fingerprint")
            if not fingerprint:
                break

            print(f"Collected {len(blacklisted_records)} addresses so far...")
            time.sleep(0.2)
        except Exception as e:
            print(f"Error fetching events: {e}")
            break

    return blacklisted_records

def save_to_files(records: List[Dict[str, Any]], csv_path="blacklisted_addresses.csv", json_path="blacklisted_addresses.json"):
    if not records:
        print("No records to save.")
        return

    # Save to CSV
    keys = records[0].keys()
    with open(csv_path, mode='w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(records)

    # Save to JSON
    with open(json_path, mode='w') as f:
        json.dump(records, f, indent=2)

    print(f"\n[SUCCESS] Successfully saved {len(records)} blacklisted addresses to:")
    print(f"  - CSV: {csv_path}")
    print(f"  - JSON: {json_path}")

if __name__ == "__main__":
    records = get_blacklisted_addresses(target_count=10000,api_key="9a0bb422-6ae4-4b49-afbd-126cbb7955b2")
    save_to_files(records)
