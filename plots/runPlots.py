import subprocess
import glob
import sys
import os

def main():
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <report_filename> <output_dir>")
        sys.exit(1)

    report_filename = sys.argv[1]
    output_dir = sys.argv[2]
    plots_dir = os.path.dirname(os.path.realpath(__file__))

    # Find all scripts matching 'plot*.py' alongside this runner.
    plot_scripts = sorted(glob.glob(os.path.join(plots_dir, "plot*.py")))

    for script in plot_scripts:
        if script == os.path.basename(__file__):
            continue  # Skip this runner script if it's named plot*.py
        print(f"Running {os.path.basename(script)}")
        subprocess.run(
            [sys.executable, script, report_filename, output_dir], check=True
        )

if __name__ == "__main__":
    main()
