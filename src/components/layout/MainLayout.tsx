import {
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type SyntheticEvent,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageTransition } from '@/components/common/PageTransition';
import { MainRoutes } from '@/router/MainRoutes';
import { authFilesApi, pluginsApi } from '@/services/api';
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconGlobe,
  IconLogOut,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconPanelLeft,
  IconRefreshCw,
  IconSearch,
  IconSidebarAuthFiles,
  IconSidebarConfig,
  IconSidebarDashboard,
  IconSidebarLogs,
  IconSidebarOauth,
  IconSidebarPlugins,
  IconSidebarProviders,
  IconSidebarQuickStart,
  IconSidebarQuota,
  IconSidebarRouting,
  IconSidebarStore,
  IconSidebarSystem,
  IconSun,
  IconX,
} from '@/components/ui/icons';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import {
  useAuthStore,
  useLoginTransitionStore,
  useConfigStore,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import { AUTH_FILES_CHANGED_EVENT } from '@/features/authFiles/authFilesEvents';
import {
  collectPluginResourceEntries,
  PLUGIN_RESOURCES_REFRESH_EVENT,
  resolvePluginAssetURL,
  type PluginResourceEntry,
} from '@/features/plugins/pluginResources';
import { APIKEY_FUN_DISPLAY_NAME, hasApiKeyFunConfig } from '@/features/providers/sponsor';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';
import { getSidebarShortcutLabel, isSidebarToggleShortcut } from '@/utils/sidebarShortcut';
import { CommandPalette, type CommandItem } from './CommandPalette';
import type { Theme } from '@/types';

const NAV_ICON_SIZE = 16;

const sidebarIcons: Record<string, ReactNode> = {
  dashboard: <IconSidebarDashboard size={NAV_ICON_SIZE} />,
  quickStart: <IconSidebarQuickStart size={NAV_ICON_SIZE} />,
  aiProviders: <IconSidebarProviders size={NAV_ICON_SIZE} />,
  authFiles: <IconSidebarAuthFiles size={NAV_ICON_SIZE} />,
  oauth: <IconSidebarOauth size={NAV_ICON_SIZE} />,
  quota: <IconSidebarQuota size={NAV_ICON_SIZE} />,
  routing: <IconSidebarRouting size={NAV_ICON_SIZE} />,
  plugins: <IconSidebarPlugins size={NAV_ICON_SIZE} />,
  pluginStore: <IconSidebarStore size={NAV_ICON_SIZE} />,
  config: <IconSidebarConfig size={NAV_ICON_SIZE} />,
  logs: <IconSidebarLogs size={NAV_ICON_SIZE} />,
  system: <IconSidebarSystem size={NAV_ICON_SIZE} />,
};

const THEME_OPTIONS: Array<{ key: Theme; labelKey: string; icon: ReactNode }> = [
  { key: 'auto', labelKey: 'theme.auto', icon: <IconMonitor size={14} /> },
  { key: 'light', labelKey: 'theme.light', icon: <IconSun size={14} /> },
  { key: 'dark', labelKey: 'theme.dark', icon: <IconMoon size={14} /> },
];

interface SidebarNavLinkItem {
  kind?: 'link';
  path: string;
  labelKey?: string;
  metaKey?: string;
  label?: string;
  meta?: string;
  badge?: number;
  badgeLabel?: string;
  icon: ReactNode;
}

interface SidebarNavDrawerItem {
  kind: 'drawer';
  id: string;
  label: string;
  meta?: string;
  icon: ReactNode;
  children: SidebarNavLinkItem[];
}

type SidebarNavItem = SidebarNavLinkItem | SidebarNavDrawerItem;

const NAV_TOOLTIP_ID = 'sidebar-nav-tooltip';
const NAV_TOOLTIP_VIEWPORT_MARGIN = 8;

interface SidebarNavGroup {
  id: string;
  labelKey: string;
  items: SidebarNavItem[];
}

const flattenNavItems = (items: SidebarNavItem[]): SidebarNavLinkItem[] =>
  items.flatMap((item) => (item.kind === 'drawer' ? item.children : [item]));

const normalizePathname = (pathname: string) => {
  const trimmed = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return trimmed === '/dashboard' ? '/' : trimmed;
};

const isMacPlatform = () => {
  if (typeof navigator === 'undefined') return false;
  const platform =
    (navigator as unknown as { userAgentData?: { platform?: string } }).userAgentData?.platform ||
    navigator.platform ||
    navigator.userAgent ||
    '';
  return /(Mac|iPhone|iPod|iPad)/i.test(platform);
};

const IS_MAC = isMacPlatform();

const isCommandPaletteShortcut = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K');

const formatHost = (apiBase: string) => {
  try {
    return new URL(apiBase).host;
  } catch {
    return apiBase;
  }
};

/** Close a popover menu on outside pointer-down or Escape. */
function useMenuDismiss(
  open: boolean,
  menuRef: RefObject<HTMLDivElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, menuRef, onClose]);
}

function PluginSidebarIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return showImage ? (
    <img src={src} alt="" onError={() => setFailed(true)} />
  ) : (
    <IconSidebarPlugins size={NAV_ICON_SIZE} />
  );
}

export function MainLayout() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const location = useLocation();
  const navigate = useNavigate();

  const logout = useAuthStore((state) => state.logout);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const supportsPlugin = useAuthStore((state) => state.supportsPlugin);

  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);
  const config = useConfigStore((state) => state.config);

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [authFilesCount, setAuthFilesCount] = useState<number | null>(null);
  const [railTooltip, setRailTooltip] = useState<{
    targetID: string;
    label: string;
    meta?: string;
    anchorTop: number;
    top: number;
  } | null>(null);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [pluginResources, setPluginResources] = useState<PluginResourceEntry[]>([]);
  const [expandedPluginResourceIDs, setExpandedPluginResourceIDs] = useState<Set<string>>(
    () => new Set()
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const authFilesCountRequestRef = useRef(0);
  const railTooltipRef = useRef<HTMLDivElement | null>(null);
  const focusedRailItemRef = useRef<HTMLElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const arrivingFromLogin = useLoginTransitionStore((state) => state.phase === 'revealing');
  const isLogsPage = location.pathname.startsWith('/logs');
  const isPluginResourcePage = location.pathname.startsWith('/plugin-pages');
  const showSidebarLabels = !sidebarCollapsed || sidebarOpen;
  const sidebarShortcutText = getSidebarShortcutLabel(IS_MAC);
  const commandShortcutText = IS_MAC ? '⌘K' : 'Ctrl K';

  // Keep floating header height available to sticky mobile elements and overlays.
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && headerRef.current
        ? new ResizeObserver(updateHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  useLayoutEffect(() => {
    if (!railTooltip) return;

    const updateRailTooltipPosition = () => {
      const tooltip = railTooltipRef.current;
      if (!tooltip) return;

      const halfHeight = tooltip.offsetHeight / 2;
      const minTop = NAV_TOOLTIP_VIEWPORT_MARGIN + halfHeight;
      const maxTop = Math.max(
        minTop,
        window.innerHeight - NAV_TOOLTIP_VIEWPORT_MARGIN - halfHeight
      );
      const top = Math.min(maxTop, Math.max(minTop, railTooltip.anchorTop));

      setRailTooltip((current) => {
        if (!current || current.targetID !== railTooltip.targetID || current.top === top) {
          return current;
        }
        return { ...current, top };
      });
    };

    updateRailTooltipPosition();
    window.addEventListener('resize', updateRailTooltipPosition);
    return () => window.removeEventListener('resize', updateRailTooltipPosition);
  }, [railTooltip]);

  // Keep the content center available to bottom overlays that align with the main area.
  useLayoutEffect(() => {
    const updateContentCenter = () => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      document.documentElement.style.setProperty('--content-center-x', `${centerX}px`);
    };

    updateContentCenter();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && contentRef.current
        ? new ResizeObserver(updateContentCenter)
        : null;

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateContentCenter);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateContentCenter);
      document.documentElement.style.removeProperty('--content-center-x');
    };
  }, []);

  const closeLanguageMenu = useCallback(() => setLanguageMenuOpen(false), []);
  const closeThemeMenu = useCallback(() => setThemeMenuOpen(false), []);
  useMenuDismiss(languageMenuOpen, languageMenuRef, closeLanguageMenu);
  useMenuDismiss(themeMenuOpen, themeMenuRef, closeThemeMenu);

  const handleLanguageSelect = useCallback(
    (nextLanguage: string) => {
      if (!isSupportedLanguage(nextLanguage)) {
        return;
      }
      setLanguage(nextLanguage);
      setLanguageMenuOpen(false);
    },
    [setLanguage]
  );

  useEffect(() => {
    fetchConfig().catch(() => {
      // Ignore the initial failure; the login flow shows the user-facing prompt.
    });
  }, [fetchConfig]);

  const loadPluginResources = useCallback(async () => {
    if (connectionStatus !== 'connected' || !supportsPlugin) {
      setPluginResources([]);
      return;
    }

    try {
      const plugins = await pluginsApi.list();
      setPluginResources(collectPluginResourceEntries(plugins.plugins));
    } catch {
      setPluginResources([]);
    }
  }, [connectionStatus, supportsPlugin]);

  const loadAuthFilesCount = useCallback(async () => {
    const requestID = ++authFilesCountRequestRef.current;
    if (connectionStatus !== 'connected') {
      setAuthFilesCount(null);
      return;
    }

    try {
      const response = await authFilesApi.list();
      if (requestID !== authFilesCountRequestRef.current) return;
      setAuthFilesCount(Array.isArray(response?.files) ? response.files.length : null);
    } catch {
      if (requestID !== authFilesCountRequestRef.current) return;
      setAuthFilesCount(null);
    }
  }, [connectionStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPluginResources();
      void loadAuthFilesCount();
    }, 0);

    window.addEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);
    window.addEventListener(AUTH_FILES_CHANGED_EVENT, loadAuthFilesCount);

    return () => {
      authFilesCountRequestRef.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener(PLUGIN_RESOURCES_REFRESH_EVENT, loadPluginResources);
      window.removeEventListener(AUTH_FILES_CHANGED_EVENT, loadAuthFilesCount);
    };
  }, [apiBase, loadPluginResources, loadAuthFilesCount]);

  const pluginResourceGroups = pluginResources.reduce<
    Array<{ pluginID: string; pluginTitle: string; entries: PluginResourceEntry[] }>
  >((groups, resource) => {
    const group = groups.find((item) => item.pluginID === resource.pluginID);
    if (group) {
      group.entries.push(resource);
      return groups;
    }

    groups.push({
      pluginID: resource.pluginID,
      pluginTitle: resource.pluginTitle,
      entries: [resource],
    });
    return groups;
  }, []);

  const pluginPageNavItems: SidebarNavItem[] = supportsPlugin
    ? pluginResourceGroups.flatMap((group): SidebarNavItem[] => {
        if (group.entries.length === 1) {
          const resource = group.entries[0];
          const pluginLogo = resolvePluginAssetURL(resource.pluginLogo, apiBase);
          return [
            {
              path: resource.route,
              label: resource.label,
              meta: resource.description,
              icon: <PluginSidebarIcon src={pluginLogo} />,
            },
          ];
        }

        const pluginLogo = resolvePluginAssetURL(group.entries[0]?.pluginLogo ?? '', apiBase);
        return [
          {
            kind: 'drawer',
            id: `plugin-pages-${group.pluginID}`,
            label: group.pluginTitle,
            meta: t('plugin_resource.page_count', { count: group.entries.length }),
            icon: <PluginSidebarIcon src={pluginLogo} />,
            children: group.entries.map((resource) => ({
              path: resource.route,
              label: resource.label,
              meta: resource.description,
              icon: <span className="nav-sub-dot" aria-hidden="true" />,
            })),
          },
        ];
      })
    : [];

  const isApiKeyFunConfigured = hasApiKeyFunConfig(config);
  const quickStartNavItem: SidebarNavLinkItem = {
    path: '/quick-start',
    label: isApiKeyFunConfigured ? APIKEY_FUN_DISPLAY_NAME : undefined,
    labelKey: isApiKeyFunConfigured ? undefined : 'nav.quick_start',
    metaKey: 'nav_meta.quick_start',
    icon: sidebarIcons.quickStart,
  };

  const navGroups: SidebarNavGroup[] = [
    {
      id: 'operate',
      labelKey: 'nav_groups.operate',
      items: [
        {
          path: '/',
          labelKey: 'nav.dashboard',
          metaKey: 'nav_meta.dashboard',
          icon: sidebarIcons.dashboard,
        },
        ...(!isApiKeyFunConfigured ? [quickStartNavItem] : []),
      ],
    },
    {
      id: 'gateway',
      labelKey: 'nav_groups.gateway',
      items: [
        {
          path: '/ai-providers',
          labelKey: 'nav.ai_providers',
          metaKey: 'nav_meta.ai_providers',
          icon: sidebarIcons.aiProviders,
        },
        {
          path: '/auth-files',
          labelKey: 'nav.auth_files',
          metaKey: 'nav_meta.auth_files',
          badge: authFilesCount ?? undefined,
          badgeLabel:
            typeof authFilesCount === 'number'
              ? t('sidebar.auth_files_count', { count: authFilesCount })
              : undefined,
          icon: sidebarIcons.authFiles,
        },
        {
          path: '/oauth',
          labelKey: 'nav.oauth',
          metaKey: 'nav_meta.oauth',
          icon: sidebarIcons.oauth,
        },
        {
          path: '/routing',
          labelKey: 'nav.routing',
          metaKey: 'nav_meta.routing',
          icon: sidebarIcons.routing,
        },
        ...(isApiKeyFunConfigured ? [quickStartNavItem] : []),
      ],
    },
    {
      id: 'observe',
      labelKey: 'nav_groups.observe',
      items: [
        {
          path: '/quota',
          labelKey: 'nav.quota_management',
          metaKey: 'nav_meta.quota_management',
          icon: sidebarIcons.quota,
        },
        {
          path: '/logs',
          labelKey: 'nav.logs',
          metaKey: 'nav_meta.logs',
          icon: sidebarIcons.logs,
        },
      ],
    },
    {
      id: 'control',
      labelKey: 'nav_groups.control',
      items: [
        {
          path: '/config',
          labelKey: 'nav.config_management',
          metaKey: 'nav_meta.config_management',
          icon: sidebarIcons.config,
        },
        ...(supportsPlugin
          ? [
              {
                path: '/plugins',
                labelKey: 'nav.plugins',
                metaKey: 'nav_meta.plugins',
                icon: sidebarIcons.plugins,
              },
              {
                path: '/plugin-store',
                labelKey: 'nav.plugin_store',
                metaKey: 'nav_meta.plugin_store',
                icon: sidebarIcons.pluginStore,
              },
            ]
          : []),
        {
          path: '/system',
          labelKey: 'nav.system_info',
          metaKey: 'nav_meta.system_info',
          icon: sidebarIcons.system,
        },
      ],
    },
    ...(pluginPageNavItems.length > 0
      ? [
          {
            id: 'plugin-pages',
            labelKey: 'nav_groups.plugin_pages',
            items: pluginPageNavItems,
          },
        ]
      : []),
  ];
  const navItems = navGroups.flatMap((group) => flattenNavItems(group.items));
  const navOrder = navItems.map((item) => item.path);
  const resolveItemLabel = (item: SidebarNavLinkItem) =>
    item.label ?? (item.labelKey ? t(item.labelKey) : '');

  const getRouteOrder = (pathname: string) => {
    const normalizedPath = normalizePathname(pathname);

    const authFilesIndex = navOrder.indexOf('/auth-files');
    if (authFilesIndex !== -1) {
      if (normalizedPath === '/auth-files') return authFilesIndex;
      if (normalizedPath.startsWith('/auth-files/')) {
        if (normalizedPath.startsWith('/auth-files/oauth-excluded')) return authFilesIndex + 0.1;
        if (normalizedPath.startsWith('/auth-files/oauth-model-alias')) return authFilesIndex + 0.2;
        return authFilesIndex + 0.05;
      }
    }

    const exactIndex = navOrder.indexOf(normalizedPath);
    if (exactIndex !== -1) return exactIndex;
    const nestedIndex = navOrder.findIndex(
      (path) => path !== '/' && normalizedPath.startsWith(`${path}/`)
    );
    return nestedIndex === -1 ? null : nestedIndex;
  };

  const getTransitionVariant = useCallback((fromPathname: string, toPathname: string) => {
    const from = normalizePathname(fromPathname);
    const to = normalizePathname(toPathname);
    const isAuthFiles = (pathname: string) =>
      pathname === '/auth-files' || pathname.startsWith('/auth-files/');
    if (isAuthFiles(from) && isAuthFiles(to)) return 'ios';
    return 'vertical';
  }, []);

  const currentPath = normalizePathname(location.pathname);
  const isCurrentItem = (item: SidebarNavLinkItem) =>
    item.path === currentPath || (item.path !== '/' && currentPath.startsWith(`${item.path}/`));
  const currentGroup = navGroups.find((group) => flattenNavItems(group.items).some(isCurrentItem));
  const currentItem = currentGroup
    ? flattenNavItems(currentGroup.items).find(isCurrentItem)
    : undefined;

  const handleRefreshAll = async () => {
    if (refreshing) return;
    setRefreshing(true);
    clearCache();
    const results = await Promise.allSettled([
      fetchConfig(true),
      loadPluginResources(),
      loadAuthFilesCount(),
      triggerHeaderRefresh(),
    ]);
    setRefreshing(false);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const reason = rejected.reason;
      const message =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
      showNotification(
        `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
      return;
    }
    showNotification(t('notification.data_refreshed'), 'success');
  };

  const togglePluginResourceDrawer = useCallback((drawerID: string) => {
    setExpandedPluginResourceIDs((current) => {
      const next = new Set(current);
      if (next.has(drawerID)) {
        next.delete(drawerID);
      } else {
        next.add(drawerID);
      }
      return next;
    });
  }, []);

  const showRailTooltip = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const anchorTop = rect.top + rect.height / 2;
      setRailTooltip({ targetID, label, meta, anchorTop, top: anchorTop });
    },
    []
  );
  const hideRailTooltip = useCallback(() => setRailTooltip(null), []);
  const handleRailTooltipMouseEnter = useCallback(
    (event: ReactMouseEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      const focusedItem = focusedRailItemRef.current;
      if (focusedItem && focusedItem !== event.currentTarget) return;
      showRailTooltip(event, targetID, label, meta);
    },
    [showRailTooltip]
  );
  const handleRailTooltipMouseLeave = useCallback(() => {
    if (!focusedRailItemRef.current) hideRailTooltip();
  }, [hideRailTooltip]);
  const handleRailTooltipFocus = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      focusedRailItemRef.current = event.currentTarget;
      showRailTooltip(event, targetID, label, meta);
    },
    [showRailTooltip]
  );
  const handleRailTooltipBlur = useCallback(
    (event: SyntheticEvent<HTMLElement>, targetID: string, label: string, meta?: string) => {
      if (focusedRailItemRef.current === event.currentTarget) {
        focusedRailItemRef.current = null;
      }
      if (event.currentTarget.matches(':hover')) {
        showRailTooltip(event, targetID, label, meta);
      } else {
        hideRailTooltip();
      }
    },
    [hideRailTooltip, showRailTooltip]
  );

  const railTooltipHandlers = (targetID: string, label: string, meta?: string) =>
    showSidebarLabels
      ? {}
      : {
          onMouseEnter: (event: ReactMouseEvent<HTMLElement>) =>
            handleRailTooltipMouseEnter(event, targetID, label, meta),
          onMouseLeave: handleRailTooltipMouseLeave,
          onFocus: (event: SyntheticEvent<HTMLElement>) =>
            handleRailTooltipFocus(event, targetID, label, meta),
          onBlur: (event: SyntheticEvent<HTMLElement>) =>
            handleRailTooltipBlur(event, targetID, label, meta),
        };

  const toggleSidebarCollapsed = useCallback(() => {
    hideRailTooltip();
    setSidebarCollapsed((prev) => !prev);
  }, [hideRailTooltip]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isCommandPaletteShortcut(event)) {
        event.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (isSidebarToggleShortcut(event)) {
        event.preventDefault();
        toggleSidebarCollapsed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebarCollapsed]);

  const commandItems: CommandItem[] = [
    ...navGroups.flatMap((group) =>
      flattenNavItems(group.items).map((item) => ({
        id: `nav:${item.path}`,
        label: resolveItemLabel(item),
        group: t('shell.group_pages'),
        icon: item.icon,
        hint: t(group.labelKey),
        keywords: [item.meta ?? (item.metaKey ? t(item.metaKey) : ''), item.path],
        active: item.path === currentPath,
        onSelect: () => navigate(item.path),
      }))
    ),
    {
      id: 'action:refresh',
      label: t('header.refresh_all'),
      group: t('shell.group_actions'),
      icon: <IconRefreshCw size={16} />,
      onSelect: () => void handleRefreshAll(),
    },
    {
      id: 'action:sidebar',
      label: sidebarCollapsed ? t('sidebar.toggle_expand') : t('sidebar.toggle_collapse'),
      group: t('shell.group_actions'),
      icon: <IconPanelLeft size={16} />,
      hint: sidebarShortcutText,
      onSelect: toggleSidebarCollapsed,
    },
    ...THEME_OPTIONS.map((option) => ({
      id: `theme:${option.key}`,
      label: `${t('theme.switch')}: ${t(option.labelKey)}`,
      group: t('shell.group_preferences'),
      icon: option.icon,
      active: theme === option.key,
      onSelect: () => setTheme(option.key),
    })),
    ...LANGUAGE_ORDER.map((lang) => ({
      id: `language:${lang}`,
      label: `${t('language.switch')}: ${t(LANGUAGE_LABEL_KEYS[lang])}`,
      group: t('shell.group_preferences'),
      icon: <IconGlobe size={16} />,
      active: language === lang,
      onSelect: () => handleLanguageSelect(lang),
    })),
    {
      id: 'action:logout',
      label: t('header.logout'),
      group: t('shell.group_actions'),
      icon: <IconLogOut size={16} />,
      onSelect: logout,
    },
  ];

  const renderNavBadge = (badge?: number, badgeLabel?: string) =>
    typeof badge === 'number' ? (
      <>
        {badge > 0 ? (
          <span className="nav-badge" aria-hidden="true">
            {badge}
          </span>
        ) : null}
        {badgeLabel ? <span className="nav-badge-sr-only">{badgeLabel}</span> : null}
      </>
    ) : null;

  const renderNavLink = (item: SidebarNavLinkItem, className = 'nav-item') => {
    const itemLabel = resolveItemLabel(item);
    const itemMeta = item.meta ?? (item.metaKey ? t(item.metaKey) : '');
    const accessibleLabel = item.badgeLabel ? `${itemLabel}, ${item.badgeLabel}` : itemLabel;

    return (
      <NavLink
        key={item.path}
        to={item.path}
        end={item.path === '/'}
        className={({ isActive }) => `${className} ${isActive ? 'active' : ''}`}
        onClick={() => {
          focusedRailItemRef.current = null;
          setSidebarOpen(false);
          hideRailTooltip();
        }}
        aria-label={showSidebarLabels ? undefined : accessibleLabel}
        aria-describedby={
          !showSidebarLabels && itemMeta && railTooltip?.targetID === item.path
            ? NAV_TOOLTIP_ID
            : undefined
        }
        {...railTooltipHandlers(item.path, itemLabel, itemMeta)}
      >
        <span className="nav-icon">{item.icon}</span>
        {showSidebarLabels ? (
          <>
            <span className="nav-text">
              <span className="nav-label">{itemLabel}</span>
            </span>
            {renderNavBadge(item.badge, item.badgeLabel)}
          </>
        ) : (
          renderNavBadge(item.badge)
        )}
      </NavLink>
    );
  };

  const renderNavItem = (item: SidebarNavItem) => {
    if (item.kind !== 'drawer') {
      return renderNavLink(item);
    }

    const isActive = item.children.some((child) => child.path === location.pathname);
    const isOpen = isActive || expandedPluginResourceIDs.has(item.id);

    return (
      <div className={`nav-drawer ${isOpen ? 'open' : ''}`} key={item.id}>
        <button
          type="button"
          className={`nav-item nav-drawer-toggle ${isActive ? 'active' : ''} ${
            isOpen ? 'open' : ''
          }`}
          onClick={() => togglePluginResourceDrawer(item.id)}
          aria-label={showSidebarLabels ? undefined : item.label}
          aria-describedby={
            !showSidebarLabels && item.meta && railTooltip?.targetID === item.id
              ? NAV_TOOLTIP_ID
              : undefined
          }
          aria-expanded={isOpen}
          {...railTooltipHandlers(item.id, item.label, item.meta)}
        >
          <span className="nav-icon">{item.icon}</span>
          {showSidebarLabels && (
            <>
              <span className="nav-text">
                <span className="nav-label">{item.label}</span>
              </span>
              <span className="nav-drawer-caret" aria-hidden="true">
                <IconChevronDown size={14} />
              </span>
            </>
          )}
        </button>
        {isOpen ? (
          <div className="nav-sub-list">
            {item.children.map((child) => renderNavLink(child, 'nav-item nav-sub-item'))}
          </div>
        ) : null}
      </div>
    );
  };

  const mobileSidebarToggleLabel = sidebarOpen
    ? t('sidebar.toggle_collapse')
    : t('sidebar.toggle_expand');
  const sidebarToggleLabel = sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse');
  const activeThemeOption =
    THEME_OPTIONS.find((option) => option.key === theme) ?? THEME_OPTIONS[0];
  const connectionLabel =
    connectionStatus === 'connected'
      ? t('common.connected_status')
      : connectionStatus === 'connecting'
        ? t('common.connecting_status')
        : t('common.disconnected_status');

  return (
    <div
      className={`app-shell ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''} ${
        isPluginResourcePage ? 'plugin-resource-shell' : ''
      } ${arrivingFromLogin ? 'app-shell--arriving' : ''}`}
    >
      <button
        type="button"
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label={t('common.close')}
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
      />

      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
      >
        <div className="sidebar-header">
          <div className="sidebar-brand" title="CLI Proxy API Management Center">
            <img src={INLINE_LOGO_JPEG} alt="" className="sidebar-brand-logo" />
            {showSidebarLabels && (
              <span className="sidebar-brand-text">
                <span className="sidebar-brand-title">CLIProxyAPI</span>
                {serverVersion ? (
                  <span className="sidebar-brand-version">{serverVersion}</span>
                ) : null}
              </span>
            )}
          </div>
          {sidebarOpen ? (
            <button
              type="button"
              className="sidebar-icon-button sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label={t('common.close')}
            >
              <IconX size={16} />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          className="sidebar-search"
          onClick={() => {
            setSidebarOpen(false);
            setCommandPaletteOpen(true);
          }}
          aria-label={t('shell.search')}
          {...railTooltipHandlers('sidebar-search', t('shell.search'), commandShortcutText)}
        >
          <IconSearch size={15} />
          {showSidebarLabels ? (
            <>
              <span className="sidebar-search-label">{t('shell.search')}</span>
              <kbd className="kbd">{commandShortcutText}</kbd>
            </>
          ) : null}
        </button>

        <nav className="nav-section" aria-label={t('shell.navigation')}>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.id}>
              {showSidebarLabels ? (
                <div className="nav-group-label">{t(group.labelKey)}</div>
              ) : (
                <div className="nav-group-divider" aria-hidden="true" />
              )}
              {group.items.map((item) => renderNavItem(item))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div
            className={`sidebar-status sidebar-status--${connectionStatus}`}
            title={`${connectionLabel} · ${apiBase}`}
          >
            <span className="sidebar-status-dot" aria-hidden="true" />
            {showSidebarLabels ? (
              <span className="sidebar-status-text">
                <span className="sidebar-status-host">{formatHost(apiBase)}</span>
                <span className="sidebar-status-label">{connectionLabel}</span>
              </span>
            ) : (
              <span className="sr-only">{connectionLabel}</span>
            )}
          </div>

          <div className="sidebar-footer-actions">
            <div className="sidebar-menu" ref={themeMenuRef}>
              <button
                type="button"
                className="sidebar-icon-button"
                onClick={() => {
                  setThemeMenuOpen((prev) => !prev);
                  setLanguageMenuOpen(false);
                }}
                aria-label={t('theme.switch')}
                title={t('theme.switch')}
                aria-haspopup="menu"
                aria-expanded={themeMenuOpen}
              >
                {activeThemeOption.icon}
              </button>
              {themeMenuOpen && (
                <div className="menu-popover" role="menu" aria-label={t('theme.switch')}>
                  <div className="menu-popover-label">{t('theme.switch')}</div>
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`menu-option ${theme === option.key ? 'active' : ''}`}
                      onClick={() => {
                        setTheme(option.key);
                        setThemeMenuOpen(false);
                      }}
                      role="menuitemradio"
                      aria-checked={theme === option.key}
                    >
                      <span className="menu-option-icon">{option.icon}</span>
                      <span className="menu-option-label">{t(option.labelKey)}</span>
                      {theme === option.key ? <IconCheck size={14} /> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-menu" ref={languageMenuRef}>
              <button
                type="button"
                className="sidebar-icon-button"
                onClick={() => {
                  setLanguageMenuOpen((prev) => !prev);
                  setThemeMenuOpen(false);
                }}
                aria-label={t('language.switch')}
                title={t('language.switch')}
                aria-haspopup="menu"
                aria-expanded={languageMenuOpen}
              >
                <IconGlobe size={14} />
              </button>
              {languageMenuOpen && (
                <div className="menu-popover" role="menu" aria-label={t('language.switch')}>
                  <div className="menu-popover-label">{t('language.switch')}</div>
                  {LANGUAGE_ORDER.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      className={`menu-option ${language === lang ? 'active' : ''}`}
                      onClick={() => handleLanguageSelect(lang)}
                      role="menuitemradio"
                      aria-checked={language === lang}
                    >
                      <span className="menu-option-label">{t(LANGUAGE_LABEL_KEYS[lang])}</span>
                      {language === lang ? <IconCheck size={14} /> : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              className="sidebar-icon-button"
              onClick={logout}
              aria-label={t('header.logout')}
              title={t('header.logout')}
            >
              <IconLogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {railTooltip && (
        <div
          ref={railTooltipRef}
          id={NAV_TOOLTIP_ID}
          className="nav-tooltip"
          role="tooltip"
          style={{ top: railTooltip.top }}
        >
          <span className="nav-tooltip-label" aria-hidden="true">
            {railTooltip.label}
          </span>
          {railTooltip.meta ? <span className="nav-tooltip-meta">{railTooltip.meta}</span> : null}
        </div>
      )}

      <div className="main-frame">
        <header className="main-header" ref={headerRef}>
          <button
            type="button"
            className="header-icon-button mobile-menu-btn"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={mobileSidebarToggleLabel}
            title={mobileSidebarToggleLabel}
          >
            <IconMenu size={16} />
          </button>
          <button
            type="button"
            className="header-icon-button sidebar-toggle-button"
            onClick={toggleSidebarCollapsed}
            aria-label={`${sidebarToggleLabel} (${sidebarShortcutText})`}
            title={`${sidebarToggleLabel} (${sidebarShortcutText})`}
          >
            <IconPanelLeft size={16} />
          </button>

          <nav className="breadcrumb" aria-label={t('shell.breadcrumb')}>
            {currentGroup ? (
              <>
                <span className="breadcrumb-segment">{t(currentGroup.labelKey)}</span>
                <IconChevronRight size={14} className="breadcrumb-separator" />
              </>
            ) : null}
            <span className="breadcrumb-segment breadcrumb-current" aria-current="page">
              {currentItem ? resolveItemLabel(currentItem) : t('nav.dashboard')}
            </span>
          </nav>

          <div className="header-actions">
            <button
              type="button"
              className="header-search-button"
              onClick={() => setCommandPaletteOpen(true)}
              aria-label={t('shell.search')}
            >
              <IconSearch size={14} />
              <span className="header-search-label">{t('shell.search')}</span>
              <kbd className="kbd">{commandShortcutText}</kbd>
            </button>
            <button
              type="button"
              className={`header-icon-button ${refreshing ? 'is-spinning' : ''}`}
              onClick={() => void handleRefreshAll()}
              aria-label={t('header.refresh_all')}
              title={t('header.refresh_all')}
              disabled={refreshing}
            >
              <IconRefreshCw size={15} />
            </button>
          </div>
        </header>

        <div
          className={`content${isLogsPage ? ' content-logs' : ''}${
            isPluginResourcePage ? ' content-plugin-resource' : ''
          }`}
          ref={contentRef}
        >
          <main
            className={`main-content${isLogsPage ? ' main-content-logs' : ''}${
              isPluginResourcePage ? ' main-content-plugin-resource' : ''
            }`}
          >
            <PageTransition
              render={(location) => <MainRoutes location={location} />}
              getRouteOrder={getRouteOrder}
              getTransitionVariant={getTransitionVariant}
              scrollContainerRef={contentRef}
            />
          </main>
        </div>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        items={commandItems}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
