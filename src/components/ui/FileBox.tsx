"use client";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";

export function FileBox({
  icon = "file",
  title,
  subtitle,
  thumbUrl,
  action,
  warning,
}: {
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  thumbUrl?: string;
  action?: ReactNode;
  warning?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border border-slate-200 bg-white p-3">
      <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-lg bg-mist text-slate-500">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Icon name={icon} size={18} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-slate-900">{title}</div>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-400">{subtitle}</div> : null}
        {warning ? <div className="mt-0.5 text-xs font-medium text-warn">{warning}</div> : null}
      </div>
      {action}
    </div>
  );
}

export function Dropzone({
  onFiles,
  title,
  subtitle,
  accept,
}: {
  onFiles: (files: FileList) => void;
  title: ReactNode;
  subtitle: ReactNode;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-xl border-[1.5px] border-dashed p-7 text-center transition-colors ${
        drag ? "border-navy bg-mist" : "border-slate-300 bg-mist hover:border-navy hover:bg-mist"
      }`}
    >
      <span className="mb-2 inline-flex text-slate-400">
        <Icon name="upload-cloud" size={24} />
      </span>
      <div className="text-sm font-medium text-slate-600">{title}</div>
      <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
    </div>
  );
}
