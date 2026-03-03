(() => {
    const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Denver";
    const $ = (s) => document.querySelector(s);

    const app = $("#app");
    const simDaySelect = $("#simDay");
    const resetBtn = $("#resetDate");
    const tzLabel = $("#tzLabel");
    const viewDateLabel = $("#viewDateLabel");

    tzLabel.textContent = TZ;

    // Populate March days
    for (let d = 1; d <= 31; d++) {
        const option = document.createElement("option");
        option.value = d;
        option.textContent = `March ${d}`;
        simDaySelect.appendChild(option);
    }

    function ymdInTZ(date, timeZone) {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric", month: "2-digit", day: "2-digit"
        }).formatToParts(date).reduce((a, p) => (a[p.type] = p.value, a), {});
        return `${parts.year}-${parts.month}-${parts.day}`;
    }

    function compareYMD(a, b) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }

    function inRange(view, start, end) {
        return compareYMD(view, start) >= 0 && compareYMD(view, end) <= 0;
    }

    function formatRange(start, end) {
        const s = new Date(start + "T00:00:00Z");
        const e = new Date(end + "T00:00:00Z");
        const fmt = new Intl.DateTimeFormat("en-US", {
            month: "short", day: "numeric", year: "numeric", timeZone: "UTC"
        });
        return `${fmt.format(s)} – ${fmt.format(e)}`;
    }

    function formatChampLocal(champISO) {
        if (!champISO) return "TBD";
        const d = new Date(champISO);
        return new Intl.DateTimeFormat("en-US", {
            timeZone: TZ,
            weekday: "short", month: "short", day: "numeric",
            hour: "numeric", minute: "2-digit"
        }).format(d);
    }

    function champDayInTZ(champISO) {
        if (!champISO) return null;
        return ymdInTZ(new Date(champISO), TZ);
    }

    function getViewingYMD() {
        const selectedDay = simDaySelect.value;

        if (!selectedDay) {
            return ymdInTZ(new Date(), TZ);
        }

        const day = String(selectedDay).padStart(2, "0");
        return `2026-03-${day}`;
    }

    // 🔥 NEW: Creates conference cell (link or plain text)
    function createConferenceCell(r) {
        const td = document.createElement("td");
        td.className = "row-strong";

        const shouldLink = (r.ongoing || r.champToday) && r.espnUrl;

        if (shouldLink) {
            const a = document.createElement("a");
            a.href = r.espnUrl;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.textContent = r.key;
            td.appendChild(a);
        } else {
            td.textContent = r.key;
        }

        return td;
    }

    function renderSection(title, badgeText, badgeClass, rows, columns, rowRenderer) {
        if (!rows.length) return;

        const section = document.createElement("section");
        section.className = "section";

        const header = document.createElement("div");
        header.className = "section-header";
        header.innerHTML = `<h2 class="section-title">${title}</h2>
                            <div class="badge ${badgeClass || ""}">${badgeText}</div>`;
        section.appendChild(header);

        const wrap = document.createElement("div");
        wrap.className = "table-wrap";

        const table = document.createElement("table");
        const thead = document.createElement("thead");
        const trh = document.createElement("tr");

        columns.forEach(c => {
            const th = document.createElement("th");
            th.textContent = c;
            trh.appendChild(th);
        });

        thead.appendChild(trh);
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        rows.forEach(r => tbody.appendChild(rowRenderer(r)));
        table.appendChild(tbody);

        wrap.appendChild(table);
        section.appendChild(wrap);
        app.appendChild(section);
    }

    function render() {
        app.innerHTML = "";
        const viewingYMD = getViewingYMD();
        viewDateLabel.textContent = viewingYMD;

        const data = window.CONFERENCE_TOURNAMENTS.map(c => {
            const champDay = champDayInTZ(c.champISO);
            const started = compareYMD(viewingYMD, c.start) >= 0;
            const over = compareYMD(viewingYMD, c.end) > 0;
            const ongoing = inRange(viewingYMD, c.start, c.end);
            const champToday = champDay === viewingYMD;

            return {
                ...c,
                champToday,
                started,
                over,
                ongoing,
                rangeText: formatRange(c.start, c.end),
                champLocalText: formatChampLocal(c.champISO)
            };
        });

        const champTodayRows = data.filter(d => d.champToday);
        const startedRows = data.filter(d => d.ongoing && !d.champToday);
        const notStartedRows = data.filter(d => !d.started);
        const overRows = data.filter(d => d.over);

        function standardRow(r) {
            const tr = document.createElement("tr");

            tr.appendChild(createConferenceCell(r));

            const tdRange = document.createElement("td");
            tdRange.textContent = r.rangeText;
            tr.appendChild(tdRange);

            const tdChamp = document.createElement("td");
            tdChamp.textContent = r.champLocalText;
            tr.appendChild(tdChamp);

            const tdTV = document.createElement("td");
            tdTV.textContent = r.channel || "TBD";
            tr.appendChild(tdTV);

            return tr;
        }

        renderSection("Conference Championship Today",
            `${champTodayRows.length} conference(s)`,
            "bad",
            champTodayRows,
            ["Conference", "Tournament Dates", "Championship (Local)", "TV"],
            standardRow
        );

        renderSection("Conference Tournament Has Started",
            `${startedRows.length} conference(s)`,
            "warn",
            startedRows,
            ["Conference", "Tournament Dates", "Championship (Local)", "TV"],
            standardRow
        );

        renderSection("Conference Tournament Schedule (Not Started Yet)",
            `${notStartedRows.length} conference(s)`,
            "good",
            notStartedRows,
            ["Conference", "Tournament Dates", "Championship (Local)", "TV"],
            standardRow
        );

        renderSection("Conference Tournament Over",
            `${overRows.length} conference(s)`,
            "",
            overRows,
            ["Conference", "Winner / Championship Info", "Tournament Dates"],
            r => {
                const tr = document.createElement("tr");

                const tdConf = document.createElement("td");
                tdConf.className = "row-strong";
                tdConf.textContent = r.key;
                tr.appendChild(tdConf);

                const tdInfo = document.createElement("td");
                tdInfo.innerHTML = r.winner
                    ? `<span class="row-strong">${r.winner}</span>`
                    : `Championship: ${r.champLocalText} • ${r.channel || "TBD"}`;
                tr.appendChild(tdInfo);

                const tdRange = document.createElement("td");
                tdRange.textContent = r.rangeText;
                tr.appendChild(tdRange);

                return tr;
            }
        );
    }

    simDaySelect.addEventListener("change", render);

    resetBtn.addEventListener("click", () => {
        simDaySelect.value = "";
        render();
    });

    render();
})();
