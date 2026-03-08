import re
import sys
from pathlib import Path

GITHUB_RAW_BASE = "https://raw.githubusercontent.com/o5sy/blog/main"


def resolve_input(arg: str | None) -> Path:
    if arg:
        p = Path(arg)
        if p.is_file():
            return p
        if p.is_dir():
            candidate = p / "draft.md"
            if candidate.exists():
                return candidate
        print(f"Error: draft.md not found in '{arg}'")
    else:
        candidate = Path.cwd() / "draft.md"
        if candidate.exists():
            return candidate
        print(f"Error: draft.md not found in '{Path.cwd()}'")

    print()
    print("Usage:")
    print("  python3 preprocess.py                   # auto-detect draft.md in current directory")
    print("  python3 preprocess.py path/to/draft.md  # specify file directly")
    print("  python3 preprocess.py path/to/dir/      # specify directory containing draft.md")
    print()
    print("  npm run devto                            # auto-detect from current directory")
    print("  npm run devto -- path/to/draft.md        # specify file directly")
    sys.exit(1)


def img_dir_github_url(input_path: Path) -> str:
    repo_root = Path(__file__).parent
    rel = input_path.parent.relative_to(repo_root)
    return f"{GITHUB_RAW_BASE}/{rel}/img"


def convert_figure(match, base_url: str) -> str:
    content = match.group(0)

    img_match = re.search(r'<img\s+src="([^"]+)"\s+alt="([^"]+)"\s*/>', content)
    figcaption_match = re.search(r'<figcaption>(.*?)</figcaption>', content, re.DOTALL)

    if not img_match:
        return content

    src = img_match.group(1)
    alt = img_match.group(2)
    result = f'![{alt}]({src})'

    if figcaption_match:
        figcaption = figcaption_match.group(1).strip()
        result += f'\n<figcaption>{figcaption}</figcaption>'

    return result


def convert_local_images(content: str, base_url: str) -> str:
    def replace(match):
        alt = match.group(1)
        filename = Path(match.group(2)).name
        return f'![{alt}]({base_url}/{filename})'

    return re.sub(r'!\[([^\]]*)\]\(\./img/([^)]+)\)', replace, content)


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    input_path = resolve_input(arg)
    output_path = input_path.parent / "devto.md"

    content = input_path.read_text(encoding='utf-8')
    base_url = img_dir_github_url(input_path)

    figure_pattern = re.compile(r'<figure>.*?</figure>', re.DOTALL)
    content = figure_pattern.sub(lambda m: convert_figure(m, base_url), content)
    content = convert_local_images(content, base_url)

    output_path.write_text(content, encoding='utf-8')
    print(f"✓ {output_path}")


if __name__ == '__main__':
    main()