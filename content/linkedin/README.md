# LinkedIn export drop folder

Put **only** these two files from your LinkedIn data export here:

- `Positions.csv`: work experience
- `Education.csv`: education

`scripts/import_linkedin.py` turns them into `data/generated/career.json`. It reads only these columns:

| File | Columns |
| --- | --- |
| Positions.csv | Company Name, Title, Description, Location, Started On, Finished On |
| Education.csv | School Name, Degree Name, Field Of Study (if present), Start Date, End Date |

**Keep everything else out of this repo.** The rest of the export contains private data such as messages, connections, and email addresses. `.gitignore` blocks any other file in this folder, but don't unzip the export inside the repo either.

## Getting the export

LinkedIn → **Settings & Privacy** → **Data privacy** → **Get a copy of your data**. Choose the files you want (or the whole archive) and request it. LinkedIn emails you when it's ready.

## Updating

1. Update your profile on LinkedIn.
2. Request a new export.
3. Replace the two CSVs here and push. The site rebuilds itself.

To tweak, hide, or add entries without touching LinkedIn, use `data/overrides/career.json`.
