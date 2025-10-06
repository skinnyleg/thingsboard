#!/bin/bash

# Script to export all ThingsBoard table schemas with column details
# This script connects to the database and runs \d for each table

OUTPUT_FILE="/home/samy/work-projects/thingsboard/predictive-maintenance/database/thingsboard_tables_structure.txt"

echo "🔍 Exporting ThingsBoard Database Schema..."
echo "================================================" > "$OUTPUT_FILE"
echo "ThingsBoard Database Tables Structure" >> "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get list of all tables (excluding partition tables)
# Partitions have patterns like: table_TIMESTAMP or table_YYYY_MM
echo "📊 Fetching table list..."
TABLES=$(cd /home/samy/work-projects/thingsboard && docker compose exec -T database psql -U postgres -d thingsboard -t -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename NOT LIKE '%_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]%'
  AND tablename NOT LIKE 'ts_kv_[0-9]%'
  AND tablename NOT IN (
    SELECT child.relname 
    FROM pg_inherits 
    JOIN pg_class parent ON pg_inherits.inhparent = parent.oid 
    JOIN pg_class child ON pg_inherits.inhrelid = child.oid
  )
ORDER BY tablename;
")

# Count tables
TABLE_COUNT=$(echo "$TABLES" | wc -l)
echo "Found $TABLE_COUNT tables to export"

# Counter for progress
COUNTER=0

# Loop through each table and export its structure
for TABLE in $TABLES; do
    # Trim whitespace
    TABLE=$(echo "$TABLE" | xargs)
    
    if [ ! -z "$TABLE" ]; then
        COUNTER=$((COUNTER + 1))
        echo "[$COUNTER/$TABLE_COUNT] Describing table: $TABLE"
        
        echo "" >> "$OUTPUT_FILE"
        echo "========================================" >> "$OUTPUT_FILE"
        echo "Table: $TABLE" >> "$OUTPUT_FILE"
        echo "========================================" >> "$OUTPUT_FILE"
        
        # Run \d command for this table
        cd /home/samy/work-projects/thingsboard && docker compose exec -T database psql -U postgres -d thingsboard -c "\\d $TABLE" >> "$OUTPUT_FILE" 2>&1
        
        echo "" >> "$OUTPUT_FILE"
    fi
done

echo "" >> "$OUTPUT_FILE"
echo "================================================" >> "$OUTPUT_FILE"
echo "Export completed at: $(date)" >> "$OUTPUT_FILE"
echo "Total tables exported: $COUNTER" >> "$OUTPUT_FILE"
echo "================================================" >> "$OUTPUT_FILE"

echo ""
echo "✅ Export complete!"
echo "📁 Output saved to: $OUTPUT_FILE"
echo "📊 Total tables: $COUNTER"
echo ""
echo "To view the file:"
echo "  less $OUTPUT_FILE"
echo ""
