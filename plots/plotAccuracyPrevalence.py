import json
import matplotlib.pyplot as plt
import os

# Load data from the JSON file
with open("report.json", "r") as f:
    data = json.load(f)

# Extract accuracy and prevalence
points = [
    (
        cluster[0]["maxAccuracyPsfDetail"]["accuracy"],
        len(cluster),
    )
    for cluster in data["psmClusters"]
]

accuracies, prevalences = zip(*points)

# Create scatter plot
plt.figure(figsize=(8, 6))
plt.scatter(accuracies, prevalences, color="blue")

# Add labels and grid
plt.xlabel("Accuracy")
plt.ylabel("Prevalence (Registration Pages)")
plt.title("Accuracy vs Prevalence")
plt.grid(True)
plt.xlim(-1, 1)

# Save to vector-based PDF
plt.savefig(os.path.join(os.path.dirname(os.path.realpath(__file__)), "out", "accuracy-prevalence.pdf"), format="pdf")
