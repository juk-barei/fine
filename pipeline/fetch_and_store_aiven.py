import os
import sys
import time
import hashlib
import argparse
from datetime import datetime, timezone
from typing import List, Dict, Any, Set
import requests
import psycopg2
from psycopg2.extras import execute_values

# Official TRC-20 USDT contract address on Tron Mainnet
USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
BASE_URL = f"https://api.trongrid.io/v1/contracts/{USDT_CONTRACT}/events"
ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

def hex_to_tron_address(hex_str: str) -> str:
    """Converts a Tron/EVM hex address into standard Tron Base58 (starts with 'T')."""
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

def init_db(conn):
    """Initializes tables in Aiven PostgreSQL if they do not exist."""
    create_table_query = """
    CREATE TABLE IF NOT EXISTS blacklisted_wallets (
        wallet_address VARCHAR(40) PRIMARY KEY,
        hex_address VARCHAR(50),
        blacklisted_timestamp BIGINT,
        blacklisted_utc TIMESTAMP WITH TIME ZONE,
        transaction_id VARCHAR(66),
        label INT DEFAULT 1,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_blacklisted_utc ON blacklisted_wallets (blacklisted_utc);
    """
    with conn.cursor() as cur:
        cur.execute(create_table_query)
    conn.commit()
    print("[DB] Tables initialized successfully in Aiven PostgreSQL.")

def save_to_db(conn, records: List[Dict[str, Any]]):
    """Upserts records into Aiven PostgreSQL using ON CONFLICT DO NOTHING."""
    if not records:
        return 0

    insert_query = """
    INSERT INTO blacklisted_wallets (
        wallet_address,
        hex_address,
        blacklisted_timestamp,
        blacklisted_utc,
        transaction_id,
        label
    ) VALUES %s
    ON CONFLICT (wallet_address) DO UPDATE SET
        transaction_id = EXCLUDED.transaction_id,
        blacklisted_timestamp = EXCLUDED.blacklisted_timestamp,
        blacklisted_utc = EXCLUDED.blacklisted_utc;
    """

    values = [
        (
            r["wallet_address"],
            r["hex_address"],
            r["blacklisted_timestamp"],
            r["blacklisted_utc"],
            r["transaction_id"],
            r["label"]
        )
        for r in records
    ]

    with conn.cursor() as cur:
        execute_values(cur, insert_query, values)
    conn.commit()
    return len(values)

def fetch_and_store(db_uri: str, target_count: int = 100, api_key: str = None):
    """
    Fetches real-time blacklisted Tron USDT addresses and streams them into Aiven PostgreSQL.
    """
    print(f"[DB] Connecting to Aiven Database...")
    try:
        conn = psycopg2.connect(db_uri)
    except Exception as e:
        print(f"[ERROR] Failed to connect to Aiven DB: {e}")
        print("\nTip: Make sure your Aiven Service URI includes sslmode=require:")
        print("Example: postgres://avnadmin:password@your-host.aivencloud.com:port/defaultdb?sslmode=require")
        sys.exit(1)

    init_db(conn)

    headers = {"User-Agent": "Mozilla/5.0"}
    if api_key:
        headers["TRON-PRO-API-KEY"] = api_key

    total_inserted = 0
    seen_addresses: Set[str] = set()
    fingerprint = None

    print(f"\n[FETCH] Fetching {target_count} blacklisted addresses from Tron USDT contract...")

    while total_inserted < target_count:
        batch_limit = min(50, target_count - total_inserted)
        params = {
            "event_name": "AddedBlackList",
            "limit": batch_limit,
            "order_by": "block_timestamp,desc"
        }
        if fingerprint:
            params["fingerprint"] = fingerprint

        try:
            res = requests.get(BASE_URL, params=params, headers=headers, timeout=15)
            if res.status_code != 200:
                print(f"[API ERROR] {res.status_code}: {res.text}")
                break

            data = res.json()
            events = data.get("data", [])
            if not events:
                print("No more events returned from TronGrid.")
                break

            batch_records = []
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

                batch_records.append({
                    "wallet_address": tron_addr,
                    "hex_address": hex_user,
                    "blacklisted_timestamp": ts_sec,
                    "blacklisted_utc": datetime.fromtimestamp(ts_sec, timezone.utc),
                    "transaction_id": event.get("transaction_id"),
                    "label": 1
                })

            if batch_records:
                inserted_count = save_to_db(conn, batch_records)
                total_inserted += inserted_count
                print(f" -> Inserted batch of {len(batch_records)} addresses into Aiven DB (Total: {total_inserted}/{target_count})")

            meta = data.get("meta", {})
            fingerprint = meta.get("fingerprint")
            if not fingerprint or total_inserted >= target_count:
                break

            time.sleep(0.2)
        except Exception as e:
            print(f"[EXCEPTION] {e}")
            break

    # Get total count currently in database
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM blacklisted_wallets;")
        db_total = cur.fetchone()[0]

    conn.close()
    print(f"\n[COMPLETED] Pipeline finished.")
    print(f"Total addresses currently stored in your Aiven database: {db_total}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch blacklisted Tron USDT addresses and store into Aiven PostgreSQL.")
    parser.add_argument("--uri", default=os.getenv("AIVEN_DB_URI"), help="Aiven PostgreSQL Service URI")
    parser.add_argument("--count", type=int, default=100, help="Number of blacklisted addresses to fetch (default: 100)")
    parser.add_argument("--api-key", default=os.getenv("TRONGRID_API_KEY"), help="Optional TronGrid API key")
    
    args = parser.parse_args()

    if not args.uri:
        print("=" * 70)
        print("ERROR: Aiven Database URI is required.")
        print("You can provide it via:")
        print("  1. Command line argument: --uri 'postgres://...'")
        print("  2. Environment variable:  export AIVEN_DB_URI='postgres://...'")
        print("=" * 70)
        print("\nWhere to find it in Aiven:")
        print("1. Log in to console.aiven.io")
        print("2. Click on your PostgreSQL service")
        print("3. In the 'Overview' tab, copy the 'Service URI'")
        print("   (Format: postgres://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslmode=require)")
        sys.exit(1)

    fetch_and_store(db_uri=args.uri, target_count=args.count, api_key="9a0bb422-6ae4-4b49-afbd-126cbb7955b2")
