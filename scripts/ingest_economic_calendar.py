#!/usr/bin/env python3
"""
Simple ingestion script for economic_calendar table.
Usage: set SUPABASE_URL and SUPABASE_ANON_KEY env vars, then run the script
with JSON lines on stdin or integrate with a provider.
"""
import os
import sys
import json
from datetime import datetime
from supabase import create_client

SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY') or os.environ.get('VITE_SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print('Missing SUPABASE_URL/KEY')
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def upsert_event(e):
    try:
        event_time = e.get('event_time')
        if isinstance(event_time, (int, float)):
            event_time = datetime.utcfromtimestamp(event_time).isoformat()
        data = {
            'event_time': event_time,
            'currency': e['currency'],
            'impact': e.get('impact', 'MEDIUM'),
            'title': e.get('title')
        }
        supabase.table('economic_calendar').insert(data).execute()
    except Exception as ex:
        print('Failed to upsert event', e, ex)

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
            upsert_event(e)
        except Exception as ex:
            print('Invalid line', line, ex)

if __name__ == '__main__':
    main()

