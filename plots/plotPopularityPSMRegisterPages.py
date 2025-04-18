from core import data, output
import matplotlib.pyplot as plt

bucket_size = 2500
num_buckets = 20


def countRegisterPages(size, offset):
    return len(
        [
            registerPage
            for registerPage in data["registerPages"]
            if any(
                site["rank"] >= offset and site["rank"] < offset + size
                for site in registerPage["sites"]
            )
        ]
    )


def countPSMRegisterPages(size, offset):
    return len(
        [
            registerPage
            for cluster in data["psmClusters"]
            for registerPage in cluster
            if any(
                site["rank"] >= offset and site["rank"] < offset + size
                for site in registerPage["sites"]
            )
        ]
    )


psm_regpages_y_values = []
regpages_y_values = []
for i in range(num_buckets):
    offset = i * bucket_size
    psm_regpages_y_values.append(countPSMRegisterPages(bucket_size, offset))
    regpages_y_values.append(countRegisterPages(bucket_size, offset))

# DEBUG
print(regpages_y_values)
print(psm_regpages_y_values)

percentages = [
    (psm / total * 100 if total > 0 else 0)
    for psm, total in zip(psm_regpages_y_values, regpages_y_values)
]

x_edges = [i * bucket_size for i in range(num_buckets + 1)]
x_centers = [x_edges[i] + bucket_size / 2 for i in range(num_buckets)]

plt.figure(figsize=(8, 6))

plt.bar(
    x_centers,
    percentages,
    width=bucket_size,
    color="purple",
    label="Registration Pages with PSM (%)",
)

plt.xticks(x_edges, rotation=90)
plt.xlabel("Popularity (Rank Ranges)")
plt.ylabel("% relative to Registration Pages")
plt.title("Percentages of Registration Pages with PSM by Popularity")
plt.grid(True, linestyle="--", alpha=0.4)
plt.tight_layout()
plt.legend()

output(plt, "popularity-psm-register-pages.pdf")
