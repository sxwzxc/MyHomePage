import { Bookmark } from '@/lib/homepage-config';

/**
 * 判断书签图标是否为自定义（emoji / 文本符号），
 * 即非 http 链接、非 data URL 的图标。
 */
export function isCustomIconBookmark(bookmark: Bookmark): boolean {
  if (bookmark.isCustomIcon) {
    return true;
  }

  const icon = bookmark.icon?.trim() || '';
  return Boolean(icon && !icon.startsWith('http') && !icon.startsWith('data:'));
}

type BookmarkAvatarProps = {
  bookmark: Bookmark;
  /** 自定义 img 尺寸类名，默认 h-10 w-10 */
  imgClassName?: string;
};

/**
 * 书签图标展示组件：
 * - 无图标：取标题首字母大写
 * - 自定义图标（emoji/文本）：直接渲染
 * - 网络/data 图标：渲染 img
 */
export default function BookmarkAvatar({
  bookmark,
  imgClassName = 'h-10 w-10 rounded-lg',
}: BookmarkAvatarProps) {
  const icon = bookmark.icon?.trim() || '';

  if (!icon) {
    return (
      <span className="text-xl font-bold text-white/90">
        {bookmark.title.slice(0, 1).toUpperCase()}
      </span>
    );
  }

  if (!icon.startsWith('http') && !icon.startsWith('data:')) {
    return <span className="text-2xl">{icon}</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={icon} alt={`${bookmark.title} icon`} className={imgClassName} />
  );
}
