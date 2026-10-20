// One icon set for the whole UI: 20×20 grid, 1.6 stroke, currentColor.

type IconProps = { size?: number; className?: string; style?: React.CSSProperties; strokeWidth?: number };

function Svg({ size = 18, className, style, children, view = 20, strokeWidth = 1.6 }: IconProps & { children: React.ReactNode; view?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${view} ${view}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M10 4v12M4 10h12" strokeWidth={2.2} /></Svg>;
export const MinusIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 10h11" strokeWidth={2} /></Svg>;
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 10.5l3.5 3.4 7.5-8" strokeWidth={2} /></Svg>;
export const ArrowLeftIcon = (p: IconProps) => <Svg {...p}><path d="M12 5l-5 5 5 5M7.5 10H16" /></Svg>;
export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="8.6" cy="8.6" r="5.4" /><path d="M12.6 12.6l4.4 4.4" /></Svg>;
export const FilterIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 4.5h13l-5 5.8v4.2l-3 1.6v-5.8l-5-5.8z" /></Svg>;
export const FolderIcon = (p: IconProps) => <Svg {...p}><path d="M3 6.2h5l1.5-1.8h7.5v10.8a1.4 1.4 0 01-1.4 1.4H4.4A1.4 1.4 0 013 15.2V6.2z" /></Svg>;
export const FolderPlusIcon = (p: IconProps) => <Svg {...p}><path d="M3 6.2h5l1.5-1.8h7.5v10.8a1.4 1.4 0 01-1.4 1.4H4.4A1.4 1.4 0 013 15.2V6.2z" /><path d="M10 8.8v4.6M7.7 11.1h4.6" /></Svg>;
export const FolderOutIcon = (p: IconProps) => <Svg {...p}><path d="M3 6.2h5l1.5-1.8h7.5v10.8a1.4 1.4 0 01-1.4 1.4H4.4A1.4 1.4 0 013 15.2V6.2z" /><path d="M13 11.3H7.5M9.4 9.4L7.5 11.3l1.9 1.9" /></Svg>;
export const ImportIcon = (p: IconProps) => <Svg {...p}><path d="M3 6.2h5l1.5-1.8h7.5v10.8a1.4 1.4 0 01-1.4 1.4H4.4A1.4 1.4 0 013 15.2V6.2z" /><path d="M10 13.6V8.8M8 10.8l2-2 2 2" /></Svg>;
export const ImageIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="4" width="14" height="12.5" rx="2" /><path d="M5.4 13.6l3.3-3.4 2.3 2.3 1.5-1.6 2.8 2.7" /><circle cx="13.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" /></Svg>;
export const PenIcon = (p: IconProps) => <Svg {...p}><path d="M14 3.2l2.8 2.8-9.2 9.2-3.7 1 1-3.7L14 3.2z" /><path d="M12.4 4.8l2.8 2.8" /></Svg>;
export const EraserIcon = (p: IconProps) => <Svg {...p}><path d="M7 16h8" /><path d="M4.4 10.6l5.8-5.8a1.7 1.7 0 012.4 0l2.5 2.5a1.7 1.7 0 010 2.4L9.6 15.2H6.7l-2.3-2.2a1.7 1.7 0 010-2.4z" /><path d="M8.8 6.2l4.4 4.4" /></Svg>;
export const RopeIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 5.5c1 4.2 3.7 7.3 11 9" strokeDasharray="2 2.2" strokeWidth={1.9} /><circle cx="4.5" cy="5.5" r="2" fill="currentColor" stroke="none" /><circle cx="15.5" cy="14.5" r="2" fill="currentColor" stroke="none" /></Svg>;
export const ArrowLinkIcon = (p: IconProps) => <Svg {...p}><rect x="2.8" y="2.8" width="5.4" height="4.4" rx="1.2" /><rect x="11.8" y="12.8" width="5.4" height="4.4" rx="1.2" /><path d="M8.2 5h3.6a1.6 1.6 0 011.6 1.6v3.6" /><path d="M11.6 8.6l1.8 1.9 1.8-1.9" /></Svg>;
export const StarIcon = (p: IconProps) => <Svg {...p}><path d="M10 2.6l2.2 5.1 5.5.5-4.2 3.6 1.3 5.4L10 14.3l-4.8 2.9 1.3-5.4-4.2-3.6 5.5-.5L10 2.6z" /></Svg>;
export const DotsGridIcon = ({ active, ...p }: IconProps & { active?: boolean }) => (
  <Svg {...p}>
    {[5, 10, 15].flatMap((y) => [5, 10, 15].map((x) => (
      <circle key={`${x}-${y}`} cx={x} cy={y} r={x === 10 && y === 10 ? 2.2 : 1.4} fill="currentColor" stroke="none" opacity={active ? (x === 10 && y === 10 ? 1 : 0.55) : 0.3} />
    )))}
  </Svg>
);
export const UserIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="7" r="3.2" /><path d="M4.2 16.4c.8-3.1 2.9-4.7 5.8-4.7s5 1.6 5.8 4.7" /></Svg>;
export const DockLeftIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="3.5" width="14" height="13" rx="2.2" /><path d="M7.4 3.8v12.4M12.4 7.6L10 10l2.4 2.4" /></Svg>;
export const DockBottomIcon = (p: IconProps) => <Svg {...p}><rect x="3" y="3.5" width="14" height="13" rx="2.2" /><path d="M3.3 12.4h13.4M7.6 7.6L10 10l2.4-2.4" /></Svg>;
export const CollapseIcon = (p: IconProps) => <Svg {...p}><circle cx="6.5" cy="6.5" r="1.9" fill="currentColor" stroke="none" /><circle cx="13.5" cy="6.5" r="1.9" fill="currentColor" stroke="none" opacity="0.55" /><circle cx="6.5" cy="13.5" r="1.9" fill="currentColor" stroke="none" opacity="0.55" /><circle cx="13.5" cy="13.5" r="1.9" fill="currentColor" stroke="none" /></Svg>;
export const CoffeeIcon = (p: IconProps) => <Svg {...p}><path d="M4.8 8h8.6v4.3c0 2.3-1.7 3.8-4.3 3.8s-4.3-1.5-4.3-3.8V8z" /><path d="M13.4 9.2h1.2c1.3 0 2.1.7 2.1 1.7s-.8 1.8-2.1 1.8h-1.2" /><path d="M6.8 5.3c-.4-.7.4-1.1.2-1.8M9.4 5.3c-.4-.7.4-1.1.2-1.8M12 5.3c-.4-.7.4-1.1.2-1.8" strokeWidth={1.3} /></Svg>;
export const EditIcon = (p: IconProps) => <Svg {...p}><path d="M13.2 3.6l3.2 3.2-9 9H4.2v-3.2l9-9z" /></Svg>;
export const TrashIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 5.5h13M8 5.5V4h4v1.5M5.2 5.5l.8 10.5h8l.8-10.5M8.4 8.6v4.6M11.6 8.6v4.6" /></Svg>;
export const BadgeIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="12" r="4.8" /><path d="M8 2.5h4v4.5H8z" /></Svg>;
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="M8 5l5 5-5 5" /></Svg>;
export const LogoutIcon = (p: IconProps) => <Svg {...p}><path d="M12.5 13.5l3.5-3.5-3.5-3.5M16 10H8" /><path d="M8 16.5H5a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 015 3.5h3" /></Svg>;
export const ExpandIcon = (p: IconProps) => <Svg {...p}><path d="M8 3H3v5M12 17h5v-5" strokeWidth={2.4} /></Svg>;
export const ShrinkIcon = (p: IconProps) => <Svg {...p}><path d="M3 8h5V3M17 12h-5v5" strokeWidth={2.4} /></Svg>;
export const LockIcon = (p: IconProps) => <Svg {...p}><rect x="4" y="9" width="12" height="8" rx="1.8" strokeWidth={2.2} /><path d="M6.8 9V6.6a3.2 3.2 0 016.4 0V9" strokeWidth={2.2} /></Svg>;
export const UnlockIcon = (p: IconProps) => <Svg {...p}><rect x="4" y="9" width="12" height="8" rx="1.8" strokeWidth={2.2} /><path d="M6.8 9V6.6a3.2 3.2 0 016.2-1.1" strokeWidth={2.2} /></Svg>;
export const ResizeIcon = (p: IconProps) => <Svg {...p}><path d="M4 16L16 4M4 10.5V16h5.5M16 9.5V4h-5.5" strokeWidth={2} /></Svg>;
export const RotateIcon = (p: IconProps) => <Svg {...p}><path d="M16 10a6 6 0 11-1.8-4.3" strokeWidth={2} /><path d="M16.2 3.5v3.6h-3.6" strokeWidth={2} /></Svg>;
