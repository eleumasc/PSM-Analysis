import argparse
import json
import os

_parser = argparse.ArgumentParser()
_parser.add_argument("report_path", type=str, help="The path to the report")
_parser.add_argument("output_dir", type=str, help="The output directory")

args = _parser.parse_args()

# Load data from the JSON file
with open(args.report_path, "r") as f:
    data = json.load(f)


def output(plt, filename):
    plt.savefig(
        os.path.join(args.output_dir, filename),
        format="pdf",
    )
