import { useState } from "react";
import { DEMO_TIME } from "@/data/mockData";
import { formatHumanReadable, applyQuickAction, parseRequestedTime, buildRequestedTime } from "@/domain/time-input";
import { Button } from "@/components/ui/button";

interface RequestedTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export function RequestedTimeInput({
  value,
  onChange,
  id = "requested-time",
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: RequestedTimeInputProps) {
  const [parts, setParts] = useState({ date: "", hour: "", minute: "" });
  const [prevValue, setPrevValue] = useState(value);

  if (value !== prevValue) {
    setPrevValue(value);
    const match = value?.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      setParts({ date: match[1], hour: match[2], minute: match[3] });
    } else if (value === "") {
      const parsedDemo = parseRequestedTime(DEMO_TIME);
      setParts({ date: parsedDemo.date, hour: "", minute: "" });
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value;
    setParts((prev) => ({ ...prev, date: d }));
    onChange(buildRequestedTime(d, parts.hour, parts.minute));
  }

  function handleHourChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const h = e.target.value;
    setParts((prev) => ({ ...prev, hour: h }));
    onChange(buildRequestedTime(parts.date, h, parts.minute));
  }

  function handleMinuteChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const m = e.target.value;
    setParts((prev) => ({ ...prev, minute: m }));
    onChange(buildRequestedTime(parts.date, parts.hour, m));
  }

  function applyQuick(addMins: number) {
    const nextIso = applyQuickAction(addMins, DEMO_TIME);
    onChange(nextIso);
  }

  const { date, hour, minute } = parts;

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = ["00", "15", "30", "45"];

  const fieldClass = "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 aria-invalid:border-red-500";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`${id}-date`} className="text-sm font-medium">
          Ngày khách yêu cầu
        </label>
        <input
          type="date"
          id={`${id}-date`}
          className={fieldClass}
          value={date}
          onChange={handleDateChange}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor={`${id}-hour`} className="text-sm font-medium">
            Giờ
          </label>
          <select
            id={`${id}-hour`}
            className={fieldClass}
            value={hour}
            onChange={handleHourChange}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
          >
            <option value="" disabled hidden>--</option>
            {hours.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor={`${id}-minute`} className="text-sm font-medium">
            Phút
          </label>
          <select
            id={`${id}-minute`}
            className={fieldClass}
            value={minute}
            onChange={handleMinuteChange}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
          >
            <option value="" disabled hidden>--</option>
            {minutes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => applyQuick(30)}>
          Qua liền
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyQuick(30)}>
          +30 phút
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyQuick(60)}>
          +1 giờ
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyQuick(120)}>
          +2 giờ
        </Button>
      </div>

      {value && formatHumanReadable(value) && (
        <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded-md border border-gray-200">
          {formatHumanReadable(value)}
        </div>
      )}
    </div>
  );
}
