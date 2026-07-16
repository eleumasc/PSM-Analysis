from core import data, output
import matplotlib.pyplot as plt

plt.rcParams.update({
    "font.size": 10,
    "axes.titlesize": 11,
    "axes.labelsize": 10,
    "xtick.labelsize": 8,
    "ytick.labelsize": 8,
    "legend.fontsize": 8,
    "lines.markersize": 4,
})

points = [
    (
        cluster[0]["maxPsfDetail"]["accuracy"],
        len(cluster),
    )
    for cluster in data["psmClusters"]
]

accuracies, prevalences = zip(*points)

plt.figure(figsize=(4.26, 4.00))
plt.scatter(accuracies, prevalences, color="blue")

plt.xlabel("Accuracy")
plt.ylabel("Prevalence (Number of Registration Pages)")
plt.title("Accuracy vs Prevalence of PSMs")
plt.grid(True)
plt.xlim(-1, 1)

output(plt, "accuracy-prevalence.thesis.pdf")
