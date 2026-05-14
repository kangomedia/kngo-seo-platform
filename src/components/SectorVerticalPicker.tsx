"use client";

import { useId } from "react";
import { SECTORS } from "@/lib/industry-taxonomy";

/**
 * Two-tier industry picker.
 *
 * Sector is a hard-constrained select — it drives the AI prompting context,
 * so it must map to a known bucket.
 *
 * Vertical is a free-text combobox (input + datalist). The taxonomy provides
 * suggestions for discoverability, but the user can type any custom label
 * (e.g. "Home Remodeler — Kitchens, Baths, Additions") to capture clients
 * that span multiple specialties or don't fit a single pre-defined vertical.
 */
export function SectorVerticalPicker({
  sector,
  vertical,
  onSectorChange,
  onVerticalChange,
}: {
  sector: string;
  vertical: string;
  onSectorChange: (s: string) => void;
  onVerticalChange: (v: string) => void;
}) {
  const listId = useId();
  const selectedSector = SECTORS.find((s) => s.label === sector);
  const suggestions = selectedSector?.verticals ?? [];

  return (
    <div className="flex flex-col gap-2">
      <select
        className="input-field"
        value={sector}
        onChange={(e) => {
          onSectorChange(e.target.value);
          onVerticalChange("");
        }}
      >
        <option value="">Select sector...</option>
        {SECTORS.map((s) => (
          <option key={s.id} value={s.label}>{s.label}</option>
        ))}
      </select>
      {sector && (
        <>
          <input
            className="input-field"
            list={listId}
            value={vertical}
            onChange={(e) => onVerticalChange(e.target.value)}
            placeholder={
              suggestions.length > 0
                ? "Pick a vertical or type a custom one..."
                : "Type your industry..."
            }
          />
          {suggestions.length > 0 && (
            <datalist id={listId}>
              {suggestions.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          )}
        </>
      )}
    </div>
  );
}
