from core import data, output
import matplotlib.pyplot as plt

points = [
    (
        cluster[0]["maxAccuracyPsfDetail"]["accuracy"],
        len(cluster),
    )
    for cluster in data["psmClusters"]
]

accuracies, prevalences = zip(*points)

plt.figure(figsize=(8, 6))
plt.scatter(accuracies, prevalences, color="blue")

plt.xlabel("Accuracy")
plt.ylabel("Prevalence (number of registration pages)")
plt.title("Accuracy vs Prevalence of PSMs")
plt.grid(True)
plt.xlim(-1, 1)

output(plt, "accuracy-prevalence.pdf")
