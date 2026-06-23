'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });
  const [focusedIndex, setFocusedIndex] = useState(0);

  // 用 ref 镜像 items 与 focusedIndex，避免 keydown 监听器随每次父组件 render 频繁重绑。
  const itemsRef = useRef(items);
  const focusedIndexRef = useRef(focusedIndex);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
  }, [focusedIndex]);

  // 调整位置以保持菜单在视口内
  useEffect(() => {
    if (!menuRef.current) return;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 右边缘溢出则水平翻转
    if (x + menuRect.width > viewportWidth) {
      adjustedX = viewportWidth - menuRect.width - 8;
    }

    // 下边缘溢出则垂直翻转
    if (y + menuRect.height > viewportHeight) {
      adjustedY = viewportHeight - menuRect.height - 8;
    }

    setPosition({ x: Math.max(8, adjustedX), y: Math.max(8, adjustedY) });
  }, [x, y]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Escape 关闭、方向键导航、回车确认
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const currentItems = itemsRef.current;
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => (prev + 1) % currentItems.length);
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev - 1 + currentItems.length) % currentItems.length);
          break;
        case 'Enter':
          event.preventDefault();
          currentItems[focusedIndexRef.current]?.onClick();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const menu = (
    <div
      ref={menuRef}
      role="menu"
      aria-orientation="vertical"
      className="fixed z-50 min-w-[160px] rounded-lg border border-white/20 bg-slate-900/95 py-1 shadow-2xl backdrop-blur-md"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          role="menuitem"
          tabIndex={focusedIndex === index ? 0 : -1}
          className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-all duration-150 ${
            item.variant === 'danger'
              ? 'text-red-200 hover:bg-red-500/20'
              : 'text-slate-100 hover:bg-white/10'
          } ${focusedIndex === index ? 'bg-white/5' : ''}`}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          onMouseEnter={() => setFocusedIndex(index)}
        >
          {item.icon && <span className="shrink-0">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );

  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(menu, document.body);
}
