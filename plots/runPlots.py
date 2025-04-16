import subprocess
import glob
import sys
import os

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <arg>")
        sys.exit(1)

    arg = sys.argv[1]

    # Find all scripts matching 'plot*.py' in the current directory
    plot_scripts = sorted(glob.glob("plot*.py"))

    for script in plot_scripts:
        if script == os.path.basename(__file__):
            continue  # Skip this runner script if it's named plot*.py
        print(f"Running {script}")
        subprocess.run(["python", script, arg])

if __name__ == "__main__":
    main()
