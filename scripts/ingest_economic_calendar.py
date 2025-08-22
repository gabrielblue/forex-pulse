#!/usr/bin/env python3
"""
Economic Calendar Ingest Script
Reads JSONL events from stdin and inserts them into Supabase calendar_events table
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional

import httpx
from supabase import create_client, Client

# Supabase configuration from environment variables
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Error: SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required")
    print("Usage: cat events.jsonl | SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 scripts/ingest_economic_calendar.py")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

def parse_event_date(date_str: str) -> Optional[datetime]:
    """Parse various date formats into datetime object"""
    date_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d"
    ]
    
    for fmt in date_formats:
        try:
            return datetime.strptime(date_str, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    
    print(f"⚠️ Warning: Could not parse date '{date_str}'")
    return None

def validate_impact(impact: str) -> str:
    """Validate and normalize impact level"""
    impact = impact.upper() if impact else 'LOW'
    if impact not in ['LOW', 'MEDIUM', 'HIGH']:
        print(f"⚠️ Warning: Invalid impact '{impact}', defaulting to 'LOW'")
        return 'LOW'
    return impact

def parse_affected_pairs(pairs_str: str) -> list:
    """Parse affected currency pairs from string"""
    if not pairs_str:
        return []
    
    # Handle various formats: "EUR/USD,GBP/USD" or "EURUSD,GBPUSD" or ["EUR/USD", "GBP/USD"]
    if isinstance(pairs_str, list):
        return pairs_str
    
    # Split by comma and clean up
    pairs = [pair.strip().replace('/', '') for pair in pairs_str.split(',') if pair.strip()]
    return pairs

def process_event(event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Process and validate a single event"""
    try:
        # Required fields
        event_name = event_data.get('event_name') or event_data.get('name')
        if not event_name:
            print("⚠️ Warning: Skipping event without name")
            return None
        
        event_date = event_data.get('event_date') or event_data.get('date') or event_data.get('time')
        if not event_date:
            print(f"⚠️ Warning: Skipping event '{event_name}' without date")
            return None
        
        parsed_date = parse_event_date(str(event_date))
        if not parsed_date:
            return None
        
        # Optional fields with defaults
        currency = event_data.get('currency', '')
        impact = validate_impact(event_data.get('impact', 'LOW'))
        forecast = event_data.get('forecast', '')
        previous = event_data.get('previous', '')
        actual = event_data.get('actual', '')
        source = event_data.get('source', 'API')
        description = event_data.get('description', '')
        
        # Parse affected pairs
        affected_pairs = parse_affected_pairs(event_data.get('affected_pairs', ''))
        
        return {
            'event_name': event_name,
            'event_date': parsed_date.isoformat(),
            'currency': currency,
            'impact': impact,
            'forecast': str(forecast) if forecast else '',
            'previous': str(previous) if previous else '',
            'actual': str(actual) if actual else '',
            'source': source,
            'description': description,
            'affected_pairs': affected_pairs
        }
        
    except Exception as e:
        print(f"❌ Error processing event: {e}")
        return None

def ingest_events():
    """Main function to ingest events from stdin"""
    print("📅 Starting economic calendar ingest...")
    
    # Get current user
    try:
        user_response = supabase.auth.get_user()
        user_id = user_response.user.id
        print(f"👤 Authenticated as user: {user_id}")
    except Exception as e:
        print(f"❌ Authentication error: {e}")
        sys.exit(1)
    
    processed_count = 0
    inserted_count = 0
    error_count = 0
    
    # Read JSONL from stdin
    for line_num, line in enumerate(sys.stdin, 1):
        line = line.strip()
        if not line:
            continue
        
        try:
            # Parse JSON line
            event_data = json.loads(line)
            processed_count += 1
            
            # Process the event
            processed_event = process_event(event_data)
            if not processed_event:
                error_count += 1
                continue
            
            # Add user_id to event
            processed_event['user_id'] = user_id
            
            # Insert into Supabase
            try:
                result = supabase.table('calendar_events').insert(processed_event).execute()
                
                if result.data:
                    inserted_count += 1
                    print(f"✅ Inserted: {processed_event['event_name']} ({processed_event['impact']})")
                else:
                    error_count += 1
                    print(f"❌ Failed to insert: {processed_event['event_name']}")
                    
            except Exception as e:
                error_count += 1
                print(f"❌ Database error for '{processed_event['event_name']}': {e}")
                
        except json.JSONDecodeError as e:
            error_count += 1
            print(f"❌ JSON parse error on line {line_num}: {e}")
        except Exception as e:
            error_count += 1
            print(f"❌ Unexpected error on line {line_num}: {e}")
    
    # Summary
    print(f"\n📊 Ingest Summary:")
    print(f"   Processed: {processed_count}")
    print(f"   Inserted: {inserted_count}")
    print(f"   Errors: {error_count}")
    
    if inserted_count > 0:
        print(f"✅ Successfully ingested {inserted_count} events")
    else:
        print("❌ No events were inserted")
        sys.exit(1)

def create_sample_events():
    """Create sample events for testing"""
    sample_events = [
        {
            "event_name": "US Non-Farm Payrolls",
            "event_date": "2024-01-05 13:30:00",
            "currency": "USD",
            "impact": "HIGH",
            "forecast": "180K",
            "previous": "173K",
            "source": "BLS",
            "description": "Employment change excluding farm workers",
            "affected_pairs": ["EURUSD", "GBPUSD", "USDJPY"]
        },
        {
            "event_name": "ECB Interest Rate Decision",
            "event_date": "2024-01-25 13:45:00",
            "currency": "EUR",
            "impact": "HIGH",
            "forecast": "4.50%",
            "previous": "4.50%",
            "source": "ECB",
            "description": "European Central Bank monetary policy decision",
            "affected_pairs": ["EURUSD", "EURGBP", "EURJPY"]
        },
        {
            "event_name": "UK CPI (YoY)",
            "event_date": "2024-01-17 09:30:00",
            "currency": "GBP",
            "impact": "MEDIUM",
            "forecast": "3.8%",
            "previous": "3.9%",
            "source": "ONS",
            "description": "UK Consumer Price Index year-over-year",
            "affected_pairs": ["GBPUSD", "EURGBP", "GBPJPY"]
        }
    ]
    
    print("📝 Creating sample events file: events.jsonl")
    with open('events.jsonl', 'w') as f:
        for event in sample_events:
            f.write(json.dumps(event) + '\n')
    
    print(f"✅ Created {len(sample_events)} sample events in events.jsonl")
    print("💡 You can now run: cat events.jsonl | SUPABASE_URL=... SUPABASE_ANON_KEY=... python3 scripts/ingest_economic_calendar.py")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--create-sample":
        create_sample_events()
    else:
        ingest_events()