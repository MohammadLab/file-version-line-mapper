from pathlib import Path
from pydriller import Repository
from pydriller.domain.commit import ModificationType

BASE_DIR = Path(__file__).resolve().parent
REPO_PATH = BASE_DIR / "dubbo"   # repo we are taking from -> thousand of commits
OUTPUT_DIR = BASE_DIR / "dataset_pairs"
FILE_TYPES = [".java", ".py"] #looking for java or python files
NUM_PAIRS  = 25 # number of files we want 
MIN_LINES = 25
MAX_LINES = 30

def line_count_ok(code: str) -> bool:
    # Strip trailing newlines so a trailing blank line doesn't bump count unfairly
    lines = code.rstrip("\n").splitlines()
    return MIN_LINES <= len(lines) <= MAX_LINES
def create_blank_mapping_xml(pair_dir: Path, pair_id: int, filename: str) -> None:
    mapping_path = pair_dir / f"pair_{pair_id:02d}_mapping.xml"
    if mapping_path.exists():
        return  # don't overwrite if it already exists
    mapping_path.touch()

def file_type_ok(filename: str) -> bool:
    if not FILE_TYPES:
        return True
    return any(filename.endswith(ext) for ext in FILE_TYPES) #grabs list of all files with .py or .java extensions

def main():
    out_dir = Path(OUTPUT_DIR)
    out_dir.mkdir(parents=True, exist_ok=True)

    pair_id = 0 #counter -> 0-25
    repo = Repository(
        path_to_repo=str(REPO_PATH),
        only_no_merge=True, #skip merges
    )

    for commit in repo.traverse_commits():
        for m in commit.modified_files:
            if m.change_type != ModificationType.MODIFY: #check for modifications that are not add/delete/renames
                continue

            if not file_type_ok(m.filename): #skip files that arent .py or .java
                continue

            old_code = m.source_code_before
            new_code = m.source_code

            if old_code is None or new_code is None: #skip if at least one is empty
                continue
            
            if not (line_count_ok(old_code) and line_count_ok(new_code)):
                continue

            suffix = Path(m.filename).suffix or ".txt" #fall back to .txt

            pair_id += 1

            pair_dir = out_dir / f"{pair_id:02d}" #make new dir for pairing (1, 2, ..., 25)
            pair_dir.mkdir(parents=True, exist_ok=True)

            old_path = out_dir / f"pair_{pair_id:02d}_v1{suffix}"
            new_path = out_dir / f"pair_{pair_id:02d}_v1{suffix}"

            old_path = pair_dir / f"pair_{pair_id:02d}_v1{suffix}"
            new_path = pair_dir / f"pair_{pair_id:02d}_v2{suffix}" #write into that new dir 

            old_path.write_text(old_code, encoding="utf-8", errors="ignore")
            new_path.write_text(new_code, encoding="utf-8", errors="ignore")

            file_for_xml = m.new_path or m.filename
            create_blank_mapping_xml(pair_dir, pair_id, file_for_xml)

            print(f"Saved pair {pair_id}: {m.new_path} @ {commit.hash[:7]}")

            if pair_id >= NUM_PAIRS:
                print("Collected ", NUM_PAIRS, "pairs.")
                return

    print("Finished Scrape, collected", pair_id, "pairs in total.")

if __name__ == "__main__":
    main()
