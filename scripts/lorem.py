"""Insert random test journal data for a user directly into the Autograt SQLite DB.

Usage: python scripts/lorem.py <username> <days> [--db path/to/autograt.db]

Days the user already has a journal entry for are skipped.
"""

import argparse
import random
import sqlite3
import sys
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "autograt.db"

NO_RATING_CHANCE = 0.05
ENTRIES_PER_DAY = (2, 6)
APPEND_COUNT_WEIGHTS = {0: 60, 1: 30, 2: 10}
CATEGORIES = (0, 1, 2)  # Neutral, Good, Bad
WORDS_PER_TEXT = 10

LOREM_WORDS = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor "
    "incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud "
    "exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure "
    "in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint "
    "occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum"
).split()


def utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def lorem() -> str:
    text = " ".join(random.choices(LOREM_WORDS, k=WORDS_PER_TEXT))
    return text[0].upper() + text[1:] + "."


def format_timestamp(moment: datetime) -> str:
    # Matches EF Core's SQLite DateTime format, e.g. 2026-09-26 14:17:32.1449088
    return moment.strftime("%Y-%m-%d %H:%M:%S.%f") + "0"


def random_moment_after(start: datetime, day_end: datetime) -> datetime:
    """A random moment between start and day_end, leaving room for later rows."""
    remaining = (day_end - start).total_seconds()
    return start + timedelta(seconds=random.uniform(0, remaining / 4))


def find_user_id(db: sqlite3.Connection, username: str) -> int | None:
    row = db.execute('SELECT Id FROM "User" WHERE Username = ?', (username,)).fetchone()
    return row[0] if row else None


def day_exists(db: sqlite3.Connection, user_id: int, day: date) -> bool:
    row = db.execute(
        'SELECT 1 FROM "JournalEntry" WHERE UserId = ? AND EntryDate = ?',
        (user_id, day.isoformat()),
    ).fetchone()
    return row is not None


def insert_day(db: sqlite3.Connection, user_id: int, day: date) -> tuple[int, int]:
    """Inserts one day's entry, sub-entries and appends. Returns (sub-entries, appends)."""
    day_start = datetime.combine(day, time.min)
    day_end = min(datetime.combine(day, time.max), utc_now())

    rating = None if random.random() < NO_RATING_CHANCE else random.randint(0, 10)
    entry_moment = random_moment_after(day_start, day_end)
    entry_id = db.execute(
        'INSERT INTO "JournalEntry" (UserId, EntryDate, DayRating, CreatedAtUtc) VALUES (?, ?, ?, ?)',
        (user_id, day.isoformat(), rating, format_timestamp(entry_moment)),
    ).lastrowid

    sub_entry_count = random.randint(*ENTRIES_PER_DAY)
    append_total = 0
    moment = entry_moment
    for _ in range(sub_entry_count):
        moment = random_moment_after(moment, day_end)
        sub_entry_id = db.execute(
            'INSERT INTO "JournalSubEntry" (JournalEntryId, Category, Content, CreatedAtUtc) VALUES (?, ?, ?, ?)',
            (entry_id, random.choice(CATEGORIES), lorem(), format_timestamp(moment)),
        ).lastrowid

        append_count = random.choices(
            list(APPEND_COUNT_WEIGHTS), weights=list(APPEND_COUNT_WEIGHTS.values())
        )[0]
        append_moment = moment
        for _ in range(append_count):
            append_moment = random_moment_after(append_moment, day_end)
            db.execute(
                'INSERT INTO "JournalAppend" (JournalSubEntryId, Content, CreatedAtUtc) VALUES (?, ?, ?)',
                (sub_entry_id, lorem(), format_timestamp(append_moment)),
            )
        append_total += append_count

    return sub_entry_count, append_total


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("username")
    parser.add_argument("days", type=int, help="Number of days to fill, counting back from today")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB, help=f"Database path (default: {DEFAULT_DB})")
    args = parser.parse_args()

    if args.days < 1:
        print("days must be at least 1", file=sys.stderr)
        return 1
    if not args.db.exists():
        print(f"Database not found: {args.db}", file=sys.stderr)
        return 1

    db = sqlite3.connect(args.db)
    try:
        user_id = find_user_id(db, args.username)
        if user_id is None:
            print(f"No user named '{args.username}'", file=sys.stderr)
            return 1

        today = utc_now().date()
        inserted_days = skipped_days = sub_entries = appends = 0
        with db:  # one transaction; rolls back on error
            for offset in range(args.days):
                day = today - timedelta(days=offset)
                if day_exists(db, user_id, day):
                    skipped_days += 1
                    continue
                day_sub_entries, day_appends = insert_day(db, user_id, day)
                inserted_days += 1
                sub_entries += day_sub_entries
                appends += day_appends

        print(
            f"{args.username}: inserted {inserted_days} days, {sub_entries} entries, "
            f"{appends} appends; skipped {skipped_days} existing days."
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
