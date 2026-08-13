// Generic permanent page for every uploaded, published presentation version.

document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("presentation-detail");
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    target.textContent = "No presentation version was selected.";
    return;
  }

  function addField(label, value) {
    const row = document.createElement("p");
    const key = document.createElement("strong");
    key.textContent = `${label}: `;
    row.append(key, document.createTextNode(value || "Not specified"));
    target.appendChild(row);
  }

  try {
    const response = await fetch(`/api/presentations/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("not found");
    const { presentation, files } = await response.json();
    document.title = `${presentation.title} ${presentation.version} - ChaosLab`;
    document.getElementById("presentation-breadcrumb").textContent = `${presentation.title} ${presentation.version}`;
    const heading = document.createElement("h1");
    heading.textContent = `${presentation.title} ${presentation.version}`;
    target.appendChild(heading);
    addField("Presentation date", presentation.date);
    addField("Authors", presentation.authors);
    addField("Change summary", presentation.summary);
    addField("Published", presentation.published_at);

    const fileHeading = document.createElement("h2");
    fileHeading.textContent = "Published files";
    target.appendChild(fileHeading);
    const fileList = document.createElement("ul");
    files.forEach((file) => {
      const item = document.createElement("li");
      const download = document.createElement("a");
      download.href = `/api/presentations/${presentation.id}/files/${file.id}/download`;
      download.textContent = `${file.original_name} (${file.size} bytes)`;
      item.appendChild(download);
      fileList.appendChild(item);
    });
    target.appendChild(fileList);
  } catch {
    target.textContent = "This published presentation version was not found.";
  }
});
