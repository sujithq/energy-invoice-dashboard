(function exposeDashboardData(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.EnergyDashboardData = api;
  }
})(typeof globalThis === "undefined" ? this : globalThis, function createApi() {
  "use strict";

  const SCHEMA_VERSION = 1;
  const MAX_JSON_CHARACTERS = 10 * 1024 * 1024;
  const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

  class DashboardDataError extends Error {
    constructor(message) {
      super(message);
      this.name = "DashboardDataError";
    }
  }

  function fail(message) {
    throw new DashboardDataError(message);
  }

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function requireRecord(value, path) {
    if (!isRecord(value)) {
      fail(`${path} moet een JSON-object zijn.`);
    }
    return value;
  }

  function requireKeys(value, allowed, required, path) {
    const record = requireRecord(value, path);
    const unknown = Object.keys(record).filter((key) => !allowed.includes(key));
    if (unknown.length > 0) {
      fail(`${path} bevat een onbekend veld en kan daarom niet veilig worden geladen.`);
    }
    const missing = required.filter((key) => !Object.hasOwn(record, key));
    if (missing.length > 0) {
      fail(`${path} mist verplicht veld '${missing[0]}'.`);
    }
    return record;
  }

  function finiteNumber(value, path, nullable = false) {
    if (nullable && value === null) {
      return null;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      fail(`${path} moet ${nullable ? "een getal of null" : "een getal"} zijn.`);
    }
    return value;
  }

  function monthKey(value, path) {
    if (typeof value !== "string" || !MONTH_PATTERN.test(value)) {
      fail(`${path} moet een geldige maand in de vorm YYYY-MM zijn.`);
    }
    return value;
  }

  function normalizeBreakdown(value, path) {
    const keys = ["fixed", "energy", "network", "taxes"];
    const record = requireKeys(value, keys, keys, path);
    return Object.fromEntries(
      keys.map((key) => [key, finiteNumber(record[key], `${path}.${key}`)]),
    );
  }

  function normalizeCapacity(value, path) {
    if (value === null) {
      return null;
    }
    const keys = ["peakKw", "adjustment", "charge"];
    const record = requireKeys(value, keys, keys, path);
    return {
      peakKw: finiteNumber(record.peakKw, `${path}.peakKw`),
      adjustment: finiteNumber(record.adjustment, `${path}.adjustment`),
      charge: finiteNumber(record.charge, `${path}.charge`),
    };
  }

  function normalizeElectricitySettlement(value, path) {
    const keys = [
      "amount",
      "actual",
      "kwh",
      "injectionKwh",
      "injectionRateEurKwh",
      "injectionCharge",
      "breakdown",
      "capacity",
    ];
    const record = requireKeys(value, keys, keys, path);
    return {
      amount: finiteNumber(record.amount, `${path}.amount`),
      actual: finiteNumber(record.actual, `${path}.actual`),
      kwh: finiteNumber(record.kwh, `${path}.kwh`, true),
      injectionKwh: finiteNumber(record.injectionKwh, `${path}.injectionKwh`, true),
      injectionRateEurKwh: finiteNumber(
        record.injectionRateEurKwh,
        `${path}.injectionRateEurKwh`,
        true,
      ),
      injectionCharge: finiteNumber(
        record.injectionCharge,
        `${path}.injectionCharge`,
        true,
      ),
      breakdown: normalizeBreakdown(record.breakdown, `${path}.breakdown`),
      capacity: normalizeCapacity(record.capacity, `${path}.capacity`),
    };
  }

  function normalizeGasSettlement(value, path) {
    const keys = ["amount", "actual", "kwh", "breakdown"];
    const record = requireKeys(value, keys, keys, path);
    return {
      amount: finiteNumber(record.amount, `${path}.amount`),
      actual: finiteNumber(record.actual, `${path}.actual`),
      kwh: finiteNumber(record.kwh, `${path}.kwh`, true),
      breakdown: normalizeBreakdown(record.breakdown, `${path}.breakdown`),
    };
  }

  function normalizeSettlement(value, path) {
    if (value === null) {
      return null;
    }
    const keys = ["electricity", "gas"];
    const record = requireKeys(value, keys, keys, path);
    return {
      electricity: normalizeElectricitySettlement(
        record.electricity,
        `${path}.electricity`,
      ),
      gas: normalizeGasSettlement(record.gas, `${path}.gas`),
    };
  }

  function normalizeAdvance(value, path) {
    if (value === null) {
      return null;
    }
    const keys = ["electricity", "gas"];
    const record = requireKeys(value, keys, keys, path);
    return {
      electricity: finiteNumber(record.electricity, `${path}.electricity`),
      gas: finiteNumber(record.gas, `${path}.gas`),
    };
  }

  function normalizeMonth(value, index) {
    const path = `months[${index}]`;
    const keys = ["month", "settlement", "advance", "injectionBonus"];
    const record = requireKeys(value, keys, keys, path);
    const normalized = {
      month: monthKey(record.month, `${path}.month`),
      settlement: normalizeSettlement(record.settlement, `${path}.settlement`),
      advance: normalizeAdvance(record.advance, `${path}.advance`),
      injectionBonus: finiteNumber(
        record.injectionBonus,
        `${path}.injectionBonus`,
      ),
    };
    if (!normalized.settlement && !normalized.advance) {
      fail(`${path} bevat geen afrekening of voorschot.`);
    }
    return normalized;
  }

  function validateDashboardSnapshot(value) {
    const record = requireKeys(
      value,
      ["schemaVersion", "months"],
      ["schemaVersion", "months"],
      "Dashboarddata",
    );
    if (record.schemaVersion !== SCHEMA_VERSION) {
      fail(
        `Onbekende schemaVersion '${String(record.schemaVersion)}'. Dit dashboard ondersteunt versie ${SCHEMA_VERSION}.`,
      );
    }
    if (!Array.isArray(record.months)) {
      fail("Dashboardveld 'months' moet een lijst zijn.");
    }

    const months = record.months.map(normalizeMonth);
    const seen = new Set();
    for (const entry of months) {
      if (seen.has(entry.month)) {
        fail(`De maand ${entry.month} komt meer dan eens voor in het bestand.`);
      }
      seen.add(entry.month);
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      months: months.sort((left, right) => left.month.localeCompare(right.month)),
    };
  }

  function parseDashboardSnapshotText(text) {
    if (typeof text !== "string") {
      fail("Het gekozen bestand kan niet als tekst worden gelezen.");
    }
    if (text.length > MAX_JSON_CHARACTERS) {
      fail("Het gekozen bestand is groter dan 10 MB en wordt niet geladen.");
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      fail(`Het bestand bevat geen geldige JSON: ${detail}`);
    }
    return validateDashboardSnapshot(parsed);
  }

  function copySettlement(settlement) {
    return {
      electricity: {
        amount: finiteNumber(
          settlement.electricity.amount,
          "settlement.electricity.amount",
        ),
        actual: finiteNumber(
          settlement.electricity.actual,
          "settlement.electricity.actual",
        ),
        kwh: finiteNumber(
          settlement.electricity.kwh,
          "settlement.electricity.kwh",
          true,
        ),
        injectionKwh: finiteNumber(
          settlement.electricity.injectionKwh,
          "settlement.electricity.injectionKwh",
          true,
        ),
        injectionRateEurKwh: finiteNumber(
          settlement.electricity.injectionRateEurKwh,
          "settlement.electricity.injectionRateEurKwh",
          true,
        ),
        injectionCharge: finiteNumber(
          settlement.electricity.injectionCharge,
          "settlement.electricity.injectionCharge",
          true,
        ),
        breakdown: normalizeBreakdown(
          settlement.electricity.breakdown,
          "settlement.electricity.breakdown",
        ),
        capacity: settlement.electricity.capacity
          ? {
              peakKw: finiteNumber(
                settlement.electricity.capacity.peakKw,
                "settlement.electricity.capacity.peakKw",
              ),
              adjustment: finiteNumber(
                settlement.electricity.capacity.adjustment,
                "settlement.electricity.capacity.adjustment",
              ),
              charge: finiteNumber(
                settlement.electricity.capacity.charge,
                "settlement.electricity.capacity.charge",
              ),
            }
          : null,
      },
      gas: {
        amount: finiteNumber(settlement.gas.amount, "settlement.gas.amount"),
        actual: finiteNumber(settlement.gas.actual, "settlement.gas.actual"),
        kwh: finiteNumber(settlement.gas.kwh, "settlement.gas.kwh", true),
        breakdown: normalizeBreakdown(
          settlement.gas.breakdown,
          "settlement.gas.breakdown",
        ),
      },
    };
  }

  function copyAdvance(advance) {
    return {
      electricity: finiteNumber(advance.electricity, "advance.electricity"),
      gas: finiteNumber(advance.gas, "advance.gas"),
    };
  }

  function createDashboardSnapshot(state) {
    requireRecord(state, "Factuurledger");
    if (!Array.isArray(state.invoices)) {
      fail("Factuurledger mist een lijst 'invoices'.");
    }

    const monthly = new Map();
    const ensureMonth = (value) => {
      const month = monthKey(value, "Afrekeningsmaand");
      if (!monthly.has(month)) {
        monthly.set(month, {
          month,
          settlement: null,
          advance: null,
          injectionBonus: 0,
        });
      }
      return monthly.get(month);
    };

    for (const invoice of state.invoices) {
      requireRecord(invoice, "Factuurrecord");
      if (invoice.settlement) {
        const target = ensureMonth(invoice.settlement.month);
        target.settlement = copySettlement(invoice.settlement);
      }
      if (invoice.advance) {
        const target = ensureMonth(invoice.advance.month);
        target.advance = copyAdvance(invoice.advance);
      }
      for (const bonus of Array.isArray(invoice.bonuses) ? invoice.bonuses : []) {
        const match = String(bonus?.label ?? "").match(
          /^Injectiebonus\s+(\d{4}-\d{2})-/i,
        );
        if (!match) {
          continue;
        }
        const target = ensureMonth(match[1]);
        target.injectionBonus = Number(
          (
            target.injectionBonus -
            finiteNumber(bonus.amount, "Injectiebonusbedrag")
          ).toFixed(2),
        );
      }
    }

    return validateDashboardSnapshot({
      schemaVersion: SCHEMA_VERSION,
      months: [...monthly.values()].sort((left, right) =>
        left.month.localeCompare(right.month),
      ),
    });
  }

  function snapshotToMonthly(snapshot) {
    const normalized = validateDashboardSnapshot(snapshot);
    return Object.fromEntries(
      normalized.months.map((entry) => {
        const settlement = entry.settlement?.electricity;
        const gas = entry.settlement?.gas;
        return [
          entry.month,
          {
            key: entry.month,
            advanceElectricity: entry.advance?.electricity ?? null,
            advanceGas: entry.advance?.gas ?? null,
            actualElectricity: settlement?.actual ?? null,
            actualGas: gas?.actual ?? null,
            settlementElectricity: settlement?.amount ?? null,
            settlementGas: gas?.amount ?? null,
            electricityKwh: settlement?.kwh ?? null,
            gasKwh: gas?.kwh ?? null,
            injectionKwh: settlement?.injectionKwh ?? null,
            injectionCharge: settlement?.injectionCharge ?? null,
            injectionRateEurKwh: settlement?.injectionRateEurKwh ?? null,
            injectionBonus: entry.injectionBonus,
            electricityBreakdown: settlement?.breakdown ?? null,
            gasBreakdown: gas?.breakdown ?? null,
            peakKw: settlement?.capacity?.peakKw ?? null,
            peakCharge: settlement?.capacity?.charge ?? null,
            peakAdjustment: settlement?.capacity?.adjustment ?? null,
            advanceInvoice: entry.advance ? "snapshot" : null,
            settlementInvoice: entry.settlement ? "snapshot" : null,
          },
        ];
      }),
    );
  }

  return {
    SCHEMA_VERSION,
    DashboardDataError,
    createDashboardSnapshot,
    parseDashboardSnapshotText,
    snapshotToMonthly,
    validateDashboardSnapshot,
  };
});
