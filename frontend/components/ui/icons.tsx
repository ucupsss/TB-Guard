/* Ikon aplikasi: semuanya dari @radix-ui/react-icons.
   Adapter ini menerima prop `size` dan `strokeWidth` (diabaikan) supaya pemakaian lama tetap kompatibel. */
import * as React from 'react';
import * as R from '@radix-ui/react-icons';
import { MicIcon } from '@/components/tb/icons';

type IconProps = Omit<React.SVGProps<SVGSVGElement>, 'ref'> & { size?: number | string; strokeWidth?: number | string };
type Svg = React.ElementType;

const wrap = (Icon: Svg, name: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const C = ({ size, strokeWidth: _strokeWidth, ...p }: IconProps) => <Icon {...(size !== undefined ? { width: size, height: size } : {})} {...p} />;
  C.displayName = name;
  return C;
};

export const Activity = wrap(R.ActivityLogIcon, 'Activity');
export const AlertTriangle = wrap(R.ExclamationTriangleIcon, 'AlertTriangle');
export const ArrowRight = wrap(R.ArrowRightIcon, 'ArrowRight');
export const Battery = wrap(R.LightningBoltIcon, 'Battery');
export const BrainCircuit = wrap(R.MixIcon, 'BrainCircuit');
export const Box = wrap(R.CubeIcon, 'Box');
export const Building2 = wrap(R.HomeIcon, 'Building2');
export const Calendar = wrap(R.CalendarIcon, 'Calendar');
export const Calculator = wrap(R.DimensionsIcon, 'Calculator');
export const Check = wrap(R.CheckIcon, 'Check');
export const CheckCircle2 = wrap(R.CheckCircledIcon, 'CheckCircle2');
export const ChevronDown = wrap(R.ChevronDownIcon, 'ChevronDown');
export const ChevronRight = wrap(R.ChevronRightIcon, 'ChevronRight');
export const Clock = wrap(R.ClockIcon, 'Clock');
export const Cpu = wrap(R.ComponentInstanceIcon, 'Cpu');
export const Download = wrap(R.DownloadIcon, 'Download');
export const Eye = wrap(R.EyeOpenIcon, 'Eye');
export const EyeOff = wrap(R.EyeClosedIcon, 'EyeOff');
export const ExternalLink = wrap(R.ExternalLinkIcon, 'ExternalLink');
export const FileCheck2 = wrap(R.FileTextIcon, 'FileCheck2');
export const FileText = wrap(R.FileTextIcon, 'FileText');
export const Film = wrap(R.VideoIcon, 'Film');
export const Filter = wrap(R.MixerHorizontalIcon, 'Filter');
export const Focus = wrap(R.Crosshair2Icon, 'Focus');
export const GitBranch = wrap(R.Share2Icon, 'GitBranch');
export const HeartHandshake = wrap(R.HeartFilledIcon, 'HeartHandshake');
export const History = wrap(R.CounterClockwiseClockIcon, 'History');
export const Info = wrap(R.InfoCircledIcon, 'Info');
export const Landmark = wrap(R.IdCardIcon, 'Landmark');
export const Layers = wrap(R.LayersIcon, 'Layers');
export const Lock = wrap(R.LockClosedIcon, 'Lock');
export const Maximize = wrap(R.EnterFullScreenIcon, 'Maximize');
export const Mic = wrap(MicIcon, 'Mic');
export const Monitor = wrap(R.DesktopIcon, 'Monitor');
export const MoreVertical = wrap(R.DotsVerticalIcon, 'MoreVertical');
export const Move3D = wrap(R.MoveIcon, 'Move3D');
export const Pause = wrap(R.PauseIcon, 'Pause');
export const Play = wrap(R.PlayIcon, 'Play');
export const Plus = wrap(R.PlusIcon, 'Plus');
export const Radio = wrap(R.RadiobuttonIcon, 'Radio');
export const Redo2 = wrap(R.ArrowRightIcon, 'Redo2');
export const RotateCcw = wrap(R.ResetIcon, 'RotateCcw');
export const Save = wrap(R.ArchiveIcon, 'Save');
export const Search = wrap(R.MagnifyingGlassIcon, 'Search');
export const Send = wrap(R.PaperPlaneIcon, 'Send');
export const Settings2 = wrap(R.GearIcon, 'Settings2');
export const ShieldAlert = wrap(R.ExclamationTriangleIcon, 'ShieldAlert');
export const ShieldCheck = wrap(R.CheckCircledIcon, 'ShieldCheck');
export const SlidersHorizontal = wrap(R.MixerHorizontalIcon, 'SlidersHorizontal');
export const Sparkles = wrap(R.MagicWandIcon, 'Sparkles');
export const Stethoscope = wrap(R.HeartIcon, 'Stethoscope');
export const Train = wrap(R.GlobeIcon, 'Train');
export const Trash2 = wrap(R.TrashIcon, 'Trash2');
export const TrendingUp = wrap(R.BarChartIcon, 'TrendingUp');
export const Undo2 = wrap(R.ArrowLeftIcon, 'Undo2');
export const Unlock = wrap(R.LockOpen1Icon, 'Unlock');
export const Upload = wrap(R.UploadIcon, 'Upload');
export const User = wrap(R.PersonIcon, 'User');
export const Users = wrap(R.PersonIcon, 'Users');
export const Video = wrap(R.CameraIcon, 'Video');
export const Volume2 = wrap(R.SpeakerLoudIcon, 'Volume2');
export const Wallet = wrap(R.CardStackIcon, 'Wallet');
export const X = wrap(R.Cross2Icon, 'X');
