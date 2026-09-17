import React from "react";
import { AlertTriangle, Trash2, X, Check } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "确认删除",
  cancelText = "取消",
  variant = "danger",
  onConfirm,
  onCancel,
}) => {
  const { isTraditional } = useTheme();

  if (!isOpen) return null;

  const getButtonStyles = () => {
    if (variant === "danger") {
      return "bg-red-600 hover:bg-red-700 text-white shadow-sm";
    }
    if (variant === "warning") {
      return "bg-amber-600 hover:bg-amber-700 text-white shadow-sm";
    }
    return "bg-blue-600 hover:bg-blue-700 text-white shadow-sm";
  };

  const getIcon = () => {
    if (variant === "danger") {
      return (
        <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
          <Trash2 className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="p-2.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5" />
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
          isTraditional
            ? "bg-white text-gray-900 border-gray-300 shadow-xl"
            : "bg-slate-900 text-slate-100 border-slate-700 shadow-2xl"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          {getIcon()}
          <div className="flex-1">
            <h3 className={`text-base font-bold ${isTraditional ? "text-gray-900" : "text-slate-100"}`}>
              {title}
            </h3>
            <p className={`text-sm mt-1.5 leading-relaxed ${isTraditional ? "text-gray-700 font-medium" : "text-slate-300"}`}>
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className={`p-1 rounded-lg transition-colors ${
              isTraditional
                ? "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-3 border-t border-gray-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
              isTraditional
                ? "bg-white border-gray-300 text-gray-800 hover:bg-gray-100"
                : "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
            }`}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${getButtonStyles()}`}
          >
            {variant === "danger" ? <Trash2 className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
