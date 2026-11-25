import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
    DashboardDataError,
    SCHEMA_VERSION,
    createDashboardSnapshot,
    parseDashboardSnapshotText,
    snapshotToMonthly,
    validateDashboardSnapshot,
} = require("../docs/dashboard-data.js");

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function syntheticLedger() {
    return {
        version: 1,
        updatedAt: "2040-02-01T12:00:00.000Z",
        privateAccount: "SYNTHETIC_ACCOUNT_SHOULD_NOT_EXPORT",
        invoices: [
            {
                invoiceNumber: "SYNTHETIC_INVOICE_SHOULD_NOT_EXPORT",
                invoiceDate: "2040-01-31",
                originalFilename: "synthetic-private-invoice.pdf",
                storedFilename: "synthetic-private-invoice.pdf",
                uploadedAt: "2040-02-01T12:00:00.000Z",
                customerAddress: "SYNTHETIC_ADDRESS_SHOULD_NOT_EXPORT",
                ean: "SYNTHETIC_EAN_SHOULD_NOT_EXPORT",
                settlement: {
                    start: "2040-01-01",
                    end: "2040-01-31",
                    month: "2040-01",
                    electricity: {
                        amount: -3.25,
                        actual: 20.5,
                        kwh: 100,
                        injectionKwh: 40,
                        injectionRateEurKwh: 0.055,
                        injectionCharge: -2.2,
                        breakdown: {
                            fixed: 4.5,
                            energy: 8.75,
                            network: 6.25,
                            taxes: 1,
                        },
                        capacity: {
                            start: "2040-01-01",
                            end: "2040-01-31",
                            month: "2040-01",
                            peakKw: 3.2,
                            days: 31,
                            annualRate: 42.5,
                            grossCharge: 7.25,
                            adjustment: -0.25,
                            charge: 7,
                        },
                    },
                    gas: {
                        amount: 6.75,
                        actual: 31.25,
                        kwh: 250,
                        breakdown: {
                            fixed: 8,
                            energy: 18.5,
                            network: 3.25,
                            taxes: 1.5,
                        },
                    },
                },
                advance: {
                    start: "2040-02-01",
                    end: "2040-02-29",
                    month: "2040-02",
                    electricity: 24,
                    gas: 35,
                },
                bonuses: [
                    {
                        label: "Injectiebonus 2040-01-01 tot 2040-01-31",
                        amount: -1.5,
                    },
                ],
            },
        ],
    };
}

test("exports only schema-versioned monthly analytics", () => {
    const snapshot = createDashboardSnapshot(syntheticLedger());
    const serialized = JSON.stringify(snapshot);

    assert.deepEqual(Object.keys(snapshot).sort(), ["months", "schemaVersion"]);
    assert.equal(snapshot.schemaVersion, SCHEMA_VERSION);
    assert.equal(snapshot.months.length, 2);
    assert.deepEqual(
        Object.keys(snapshot.months[0]).sort(),
        ["advance", "injectionBonus", "month", "settlement"],
    );

    for (const forbidden of [
        "SYNTHETIC_ACCOUNT_SHOULD_NOT_EXPORT",
        "SYNTHETIC_INVOICE_SHOULD_NOT_EXPORT",
        "SYNTHETIC_ADDRESS_SHOULD_NOT_EXPORT",
        "SYNTHETIC_EAN_SHOULD_NOT_EXPORT",
        "synthetic-private-invoice.pdf",
        "2040-01-31",
        "invoiceNumber",
        "invoiceDate",
        "originalFilename",
        "storedFilename",
        "uploadedAt",
        "customerAddress",
        "ean",
    ]) {
        assert.doesNotMatch(serialized, new RegExp(escapeRegExp(forbidden), "i"));
    }

    const january = snapshot.months.find((entry) => entry.month === "2040-01");
    assert.equal(january.settlement.electricity.actual, 20.5);
    assert.equal(january.settlement.electricity.capacity.peakKw, 3.2);
    assert.equal(january.settlement.gas.actual, 31.25);
    assert.equal(january.injectionBonus, 1.5);
});

test("round-trips a local export through viewer data conversion", () => {
    const exported = JSON.stringify(createDashboardSnapshot(syntheticLedger()));
    const loaded = parseDashboardSnapshotText(exported);
    const monthly = snapshotToMonthly(loaded);

    assert.equal(monthly["2040-01"].actualElectricity, 20.5);
    assert.equal(monthly["2040-01"].injectionBonus, 1.5);
    assert.equal(monthly["2040-02"].advanceElectricity, 24);
    assert.equal(monthly["2040-02"].settlementInvoice, null);
});

test("rejects malformed and privacy-unsafe snapshots with clear errors", () => {
    assert.throws(
        () => parseDashboardSnapshotText("{"),
        (error) =>
            error instanceof DashboardDataError &&
            /geen geldige JSON/i.test(error.message),
    );
    assert.throws(
        () =>
            validateDashboardSnapshot({
                schemaVersion: SCHEMA_VERSION + 1,
                months: [],
            }),
        /schemaVersion/i,
    );
    assert.throws(
        () =>
            validateDashboardSnapshot({
                schemaVersion: SCHEMA_VERSION,
                months: [],
                privateAccount: "not allowed",
            }),
        /onbekend veld/i,
    );

    const snapshot = createDashboardSnapshot(syntheticLedger());
    assert.throws(
        () =>
            validateDashboardSnapshot({
                ...snapshot,
                months: [...snapshot.months, snapshot.months[0]],
            }),
        /meer dan eens/i,
    );
    assert.throws(
        () =>
            validateDashboardSnapshot({
                schemaVersion: SCHEMA_VERSION,
                months: [{ ...snapshot.months[0], month: "not-a-month" }],
            }),
        /YYYY-MM/i,
    );
});

test("static viewer has local-only controls and no invoice network behavior", async () => {
    const viewer = await readFile(join(repositoryRoot, "docs", "index.html"), "utf8");

    assert.match(viewer, /connect-src 'none'/);
    assert.match(viewer, /accept="application\/json,\.json"/);
    assert.match(viewer, /Laad privé JSON/);
    assert.match(viewer, /Wis lokale data/);
    assert.match(viewer, /indexedDB\.open/);
    assert.doesNotMatch(viewer, /\bfetch\s*\(/);
    assert.doesNotMatch(viewer, /XMLHttpRequest|WebSocket|EventSource|sendBeacon/);
    assert.doesNotMatch(viewer, /\/api\//);
    assert.doesNotMatch(viewer, /accept="[^"]*\.pdf/i);
    assert.doesNotMatch(viewer, /https?:\/\//);

    for (const analyticsId of [
        "trendChart",
        "unitCostChart",
        "forecastMetrics",
        "capacityPeakChart",
        "gridBalanceChart",
        "qualitySignals",
        "gasSeasonChart",
        "compareBody",
    ]) {
        assert.match(viewer, new RegExp(`id="${analyticsId}"`));
    }
});

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
