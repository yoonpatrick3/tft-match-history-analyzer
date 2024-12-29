document.getElementById("usernameForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const input = document.getElementById("username").value.trim();
    const output = document.getElementById("output");
    const loading = document.getElementById("loading");

    if (!input.includes("#")) {
        output.innerHTML = "Invalid input format. Please use the format RiotID#Tagline.";
        return;
    }

    const [username, tagline] = input.split("#");

    if (!username || !tagline) {
        output.innerHTML = "Invalid input. Make sure both RiotID and Tagline are provided.";
        return;
    }

    loading.style.display = "flex";

    try {
        const response = await fetch(
            `https://tft-match-history-analyzer-26116b41405e.herokuapp.com/api/match-history?username=${encodeURIComponent(username)}&tagline=${encodeURIComponent(tagline)}`
        );
        const data = await response.json();

        loading.style.display = "none";

        if (data.error) {
            output.innerHTML = `Error: ${data.error}`;
        } else {
            displayResults(data);
        }
    } catch (error) {
        console.error(error);
        loading.style.display = "none";
        output.innerHTML = "An error occurred. Please try again.";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("username");

    function adjustInputWidth() {
        const placeholder = input.getAttribute("placeholder");
        const tempSpan = document.createElement("span");

        tempSpan.style.font = window.getComputedStyle(input).font;
        tempSpan.style.visibility = "hidden";
        tempSpan.style.whiteSpace = "nowrap";
        tempSpan.textContent = placeholder;

        document.body.appendChild(tempSpan);
        const newWidth = tempSpan.offsetWidth + 20;
        input.style.width = `${newWidth}px`;
        document.body.removeChild(tempSpan);
    }

    adjustInputWidth();

    input.addEventListener("input", adjustInputWidth);
});

function displayResults(data) {
    const output = document.getElementById("output");

    output.innerHTML = `
        <div id="loading" style="display: none;">
            <div class="spinner"></div>
        </div>
    `;

    const createSection = (title, entries, type) => {
        const section = document.createElement("div");
        section.classList.add("section");

        const heading = document.createElement("h2");
        heading.textContent = title;
        section.appendChild(heading);

        const list = document.createElement("div");
        list.classList.add("list");

        entries.forEach(entry => {
            const item = document.createElement("div");
            item.classList.add("entry");

            if (type === "traits") {
                const imgContainer = document.createElement("div");
                imgContainer.style.backgroundColor = "black";
                imgContainer.style.borderRadius = "5px";
                imgContainer.style.display = "inline-block";
                imgContainer.style.padding = "5px";

                const img = document.createElement("img");
                img.src = entry.image;
                img.alt = entry.name;
                img.style.display = "block";
                imgContainer.appendChild(img);
                item.appendChild(imgContainer);
            } else if (type === "items") {
                const sideBySideDiv = document.createElement("div");
                sideBySideDiv.classList.add("side-by-side");

                const unitDiv = document.createElement("div");
                unitDiv.classList.add("unit");

                const unitImg = document.createElement("img");
                unitImg.src = entry.unitImage;
                unitImg.alt = entry.unit;

                unitDiv.appendChild(unitImg);
                sideBySideDiv.appendChild(unitDiv);

                const itemDiv = document.createElement("div");
                itemDiv.classList.add("item");

                const itemImg = document.createElement("img");
                itemImg.src = entry.itemImage;
                itemImg.alt = entry.item;

                itemDiv.appendChild(itemImg);
                sideBySideDiv.appendChild(itemDiv);

                item.appendChild(sideBySideDiv);
            } else {
                const img = document.createElement("img");
                img.src = entry.image || entry.unitImage || entry.itemImage;
                img.alt = entry.name || entry.item || entry.unit;
                item.appendChild(img);
            }

            const text = document.createElement("div");

            if (type === "items") {
                text.innerHTML = `
                    <strong>${entry.item} on ${entry.unit}</strong><br>
                    Avg Placement: ${entry.avgPlacement.toFixed(2)}
                `;
            } else {
                text.innerHTML = `
                    <strong>${entry.name || entry.item || entry.unit}</strong><br>
                    Avg Placement: ${entry.avgPlacement.toFixed(2)}
                `;
            }

            item.appendChild(text);
            list.appendChild(item);
        });

        section.appendChild(list);
        return section;
    };

    output.appendChild(createSection("Top 3 Traits", data.traits.top, "traits"));
    output.appendChild(createSection("Bottom 3 Traits", data.traits.bottom, "traits"));

    output.appendChild(createSection("Top 3 Units", data.units.top, "units"));
    output.appendChild(createSection("Bottom 3 Units", data.units.bottom, "units"));

    output.appendChild(createSection("Top 3 Items", data.items.top, "items"));
    output.appendChild(createSection("Bottom 3 Items", data.items.bottom, "items"));
}
