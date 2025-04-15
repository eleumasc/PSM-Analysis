import argparse
import json
import os

_parser = argparse.ArgumentParser()
_parser.add_argument("report_path", type=str, help="The path to the report")

args = _parser.parse_args()

# Load data from the JSON file
with open(args.report_path, "r") as f:
    data = json.load(f)


def output(plt, filename):
    plt.savefig(
        os.path.join(os.path.dirname(os.path.realpath(__file__)), "out", filename),
        format="pdf",
    )
