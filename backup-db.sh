#!/bin/bash
# DayLog database backup — safe to run while the server is running.
# Uses SQLite's .backup command which handles WAL mode correctly.
# Keeps the last 30 daily backups.

DB="/home/luke/MyCode/src/DayLog/data/daylog.db"
BACKUP_DIR="/home/luke/MyCode/src/DayLog/data/backups"
BACKUP_FILE="$BACKUP_DIR/daylog-$(date +%Y-%m-%d).db"

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB" ".backup '$BACKUP_FILE'"

# Remove backups older than 30 days
find "$BACKUP_DIR" -name "daylog-*.db" -mtime +30 -delete

echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
