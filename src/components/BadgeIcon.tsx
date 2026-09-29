import React from 'react';
import {
  Search,
  Database,
  Table2,
  Code2,
  Eraser,
  Wrench,
  BarChart3,
  Terminal,
  LayoutDashboard,
  Monitor,
  Sigma,
  Network,
  FileText,
  Lightbulb,
  Briefcase,
  Target,
  Users,
  ShoppingCart,
  Settings,
  Wallet,
  Package,
  Megaphone,
  Cpu,
  Gauge,
  Award,
  Flag,
  Crown,
} from 'lucide-react';
import { LongTermBadge } from '../utils/badgeSystem';

interface BadgeIconProps {
  badge: LongTermBadge;
  className?: string;
}

const badgeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  trainee: Search,
  'data-trainee': Database,
  'day-15': Table2,
  'analytics-associate': Code2,
  'day-45': Eraser,
  'day-60': Wrench,
  'day-75': BarChart3,
  'bi-analyst': Terminal,
  'data-analyst-ii': LayoutDashboard,
  'day-270': Monitor,
  'day-360': Sigma,
  'day-450': Network,
  'day-540': FileText,
  'day-630': Lightbulb,
  'day-720': Briefcase,
  'day-810': Target,
  'day-900': Users,
  'day-990': ShoppingCart,
  'day-1080': Settings,
  'day-1170': Wallet,
  'day-1260': Package,
  'day-1350': Megaphone,
  'day-1440': Cpu,
  'day-1530': Gauge,
  'day-1620': Award,
  'day-1710': Flag,
  'day-1800': Crown,
};

export const BadgeIcon: React.FC<BadgeIconProps> = ({ badge, className = 'w-4 h-4' }) => {
  const Icon = badgeIcons[badge.id] ?? Award;
  return <Icon className={className} />;
};
