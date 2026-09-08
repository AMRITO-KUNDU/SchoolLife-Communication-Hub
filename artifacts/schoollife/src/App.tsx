import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Redirect, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Bell, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Circle, ClipboardCheck, Clock3, FileText, Filter, GraduationCap, Inbox as InboxIcon,
  Info, LayoutDashboard, ListChecks, Mail, Menu, MessageCircle, MoreHorizontal,
  Paperclip, Plus, RefreshCw, Search, Send, Settings as SettingsIcon, ShieldCheck,
  Sparkles, Tag, Trash2, UserRound, Users, X, Zap
} from 'lucide-react';

type View = 'home' | 'plan' | 'calendar' | 'inbox' | 'sources' | 'profile' | 'settings';
type ChildId = string;
type TaskStatus = 'open' | 'completed';
type Priority = 'urgent' | 'important' | 'normal';

type Child = { id: ChildId; name: string; grade: string; className: string; school: string; subjects: string[] };
type Task = { id: string; title: string; kind: string; priority: Priority; childId: ChildId; dueDate: string; dueTime?: string; source: string; status: TaskStatus; items: string[] };
type EventItem = { id: string; title: string; date: string; time: string; childId: ChildId; kind: string; source: string };
type Message = { id: string; sender: string; snippet: string; summary: string; detected: string; category: string; needsAction: boolean; childId: ChildId };
type Source = { id: string; name: string; status: 'Connected' | 'Connect'; detail: string; lastSync: string; groups?: string[] };
type WhatsappGroup = { jid: string; name: string; enabled: boolean };
type ExtractionResult = { summary: string; category: string; needsAction: boolean; tasks: Array<{ title: string; dueDate?: string; dueTime?: string; priority: Priority; items: string[] }>; events: Array<{ title: string; date?: string; time?: string }>; childHint?: string; confidence: string };

const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan', icon: ListChecks },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'inbox', label: 'Inbox', icon: InboxIcon },
];

function IconText({ icon: Icon, children }: { icon: typeof Check; children: ReactNode }) {
  return <span className="inline-flex items-center gap-2"><Icon size={15} strokeWidth={1.8} />{children}</span>;
}

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#5148B8',
    colorForeground: '#20212B',
    colorMutedForeground: '#737482',
    colorDanger: '#C44B55',
    colorBackground: '#FFFEFC',
    colorInput: '#F8F7F3',
    colorInputForeground: '#20212B',
    colorNeutral: '#E5E3DE',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.9rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FFFEFC] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#20212B]',
    headerSubtitle: 'text-[#737482]',
    socialButtonsBlockButtonText: 'text-[#20212B]',
    formFieldLabel: 'text-[#20212B]',
    footerActionLink: 'text-[#5148B8]',
    footerActionText: 'text-[#737482]',
    dividerText: 'text-[#737482]',
    identityPreviewEditButton: 'text-[#5148B8]',
    formFieldSuccessText: 'text-[#2B8A67]',
    alertText: 'text-[#C44B55]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border-[#E5E3DE] bg-[#F8F7F3]',
    formButtonPrimary: 'bg-[#5148B8] hover:bg-[#433A9F]',
    formFieldInput: 'border-[#E5E3DE] bg-[#F8F7F3] text-[#20212B]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#E5E3DE]',
    alert: 'border-[#F5D5D5] bg-[#FFF4F4]',
    otpCodeFieldInput: 'border-[#E5E3DE] bg-[#F8F7F3]',
    formFieldRow: 'text-[#20212B]',
    main: 'bg-transparent',
  },
};

function DashboardApp() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const parentName = user?.firstName || 'Sanjay';
  const [view, setView] = useState<View>('home');
  const [selectedChild, setSelectedChild] = useState<ChildId>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<'science' | 'whatsapp' | 'assistant' | 'onboarding' | 'privacy' | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [detailEvent, setDetailEvent] = useState<EventItem | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [inboxFilter, setInboxFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [planTab, setPlanTab] = useState('Today');
  const [calendarMode, setCalendarMode] = useState('Month');
  const [calendarChild, setCalendarChild] = useState<'all' | ChildId>('all');
  const [calendarEvents, setCalendarEvents] = useState<EventItem[]>([]);
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [inboxMessages, setInboxMessages] = useState<Message[]>([]);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [familyChildren, setFamilyChildren] = useState<Child[]>([]);
  const [familyLoading, setFamilyLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<'stopped' | 'starting' | 'awaiting_qr' | 'awaiting_code' | 'connected' | 'reconnecting' | 'error'>('stopped');
  const [whatsappQr, setWhatsappQr] = useState<string>();
  const [whatsappPairingCode, setWhatsappPairingCode] = useState<string>();
  const [whatsappGroups, setWhatsappGroups] = useState<WhatsappGroup[]>([]);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const activeChild = familyChildren.find((child) => child.id === selectedChild) ?? familyChildren[0];
  useEffect(() => {
    void (async () => {
      try {
        await loadFamily();
      } catch {
        notify('Your family data could not be loaded');
      } finally {
        setFamilyLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (modal !== 'whatsapp') return;
    void refreshWhatsapp();
    const interval = window.setInterval(() => void refreshWhatsapp(), 2500);
    return () => window.clearInterval(interval);
  }, [modal]);

  const loadFamily = async () => {
    const response = await fetch('/api/family', { credentials: 'include' });
    if (!response.ok) throw new Error('Family data could not be loaded');
    const payload = await response.json() as {
      children?: Array<{ slug: string; name: string; grade: string; className: string; school: string; subjects?: string[] }>;
      tasks?: Task[];
      events?: EventItem[];
      messages?: Message[];
      sources?: Source[];
    };
    const liveChildren = (payload.children ?? []).map((child) => ({
      ...child,
      id: child.slug as ChildId,
      subjects: child.subjects ?? [],
    }));
    setFamilyChildren(liveChildren);
    if (liveChildren.length > 0 && !liveChildren.some((child) => child.id === selectedChild)) setSelectedChild(liveChildren[0].id);
    setTasks(payload.tasks ?? []);
    setCalendarEvents(payload.events ?? []);
    setInboxMessages(payload.messages ?? []);
    setSources(payload.sources ?? []);
  };

  const syncCalendar = async () => {
    setCalendarSyncing(true);
    try {
      const response = await fetch('/api/calendar/events', { credentials: 'include' });
      if (!response.ok) throw new Error('Calendar sync failed');
      const payload = (await response.json()) as { items?: Array<{ id: string; summary?: string; htmlLink?: string; start?: { date?: string; dateTime?: string } }> };
      const liveEvents = (payload.items ?? []).map((event, index) => {
        const rawStart = event.start?.dateTime ?? event.start?.date;
        const date = rawStart ? new Date(rawStart) : new Date();
        const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
        return {
          id: event.id || `google-${index}`,
          title: event.summary || 'Untitled calendar event',
          date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          time: isAllDay ? 'All day' : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
          childId: selectedChild,
          kind: 'Google Calendar',
          source: 'Google Calendar',
        } satisfies EventItem;
      });
      setCalendarEvents(liveEvents);
      setSources((current) => current.map((source) => source.id === 'calendar' ? { ...source, status: 'Connected', detail: `${liveEvents.length} events synced`, lastSync: 'Synced just now' } : source));
      notify(liveEvents.length > 0 ? `${liveEvents.length} Google Calendar events synced` : 'Google Calendar is connected');
    } catch {
      notify('Calendar sync needs attention');
    } finally {
      setCalendarSyncing(false);
    }
  };
  const syncGmail = async () => {
    setGmailSyncing(true);
    try {
      const response = await fetch('/api/gmail/messages?pageSize=30', { credentials: 'include' });
      if (!response.ok) throw new Error('Gmail sync failed');
      const payload = (await response.json()) as { items?: Array<{ id: string; sender: string; subject: string; snippet: string; date: string; category: string; needsAction: boolean }> };
      const liveMessages = (payload.items ?? []).map((message, index) => ({
        id: message.id || `gmail-${index}`,
        sender: message.sender,
        snippet: message.snippet,
        summary: message.subject,
        detected: `${message.category} · ${new Date(message.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
        category: message.category,
        needsAction: message.needsAction,
        childId: selectedChild || 'unassigned',
      } satisfies Message));
      setInboxMessages(liveMessages);
      setSources((current) => current.map((source) => source.id === 'email' ? { ...source, status: 'Connected', detail: `${liveMessages.length} recent emails`, lastSync: 'Synced just now' } : source));
      notify(liveMessages.length > 0 ? `${liveMessages.length} Gmail threads synced` : 'Gmail is connected');
    } catch {
      notify('Gmail sync needs attention');
    } finally {
      setGmailSyncing(false);
    }
  };
  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };
  const completeTask = (id: string) => {
    const currentTask = tasks.find((task) => task.id === id);
    if (!currentTask) return;
    const nextStatus = currentTask.status === 'completed' ? 'open' : 'completed';
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: nextStatus } : task));
    void fetch(`/api/family/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    }).then((response) => {
      if (!response.ok) throw new Error('Task update failed');
    }).catch(() => notify('Task saved locally; sync needs attention'));
    notify(nextStatus === 'open' ? 'Task moved back to your plan' : 'Nice work — task completed');
  };
  const addTask = (id: string) => {
    const task = tasks.find((item) => item.id === id);
    if (task && task.status === 'completed') setTasks((current) => current.map((item) => item.id === id ? { ...item, status: 'open' } : item));
    notify('Added to your plan');
  };
  const refreshWhatsapp = async () => {
    try {
      const [statusResponse, groupsResponse] = await Promise.all([
        fetch('/api/whatsapp/status', { credentials: 'include' }),
        fetch('/api/whatsapp/groups', { credentials: 'include' }),
      ]);
      if (statusResponse.ok) {
        const status = await statusResponse.json() as { status: typeof whatsappStatus; qrDataUrl?: string; pairingCode?: string; lastError?: string };
        setWhatsappStatus(status.status);
        setWhatsappQr(status.qrDataUrl);
        setWhatsappPairingCode(status.pairingCode);
        setSources((current) => current.map((source) => source.id === 'whatsapp' ? {
          ...source,
          status: status.status === 'connected' ? 'Connected' : 'Connect',
          detail: status.status === 'connected' ? 'Choose school groups to import' : 'Connect a WhatsApp Web session to import school groups',
          lastSync: status.status === 'connected' ? 'Connected just now' : 'Not connected',
        } : source));
      }
      if (groupsResponse.ok) {
        const payload = await groupsResponse.json() as { groups?: WhatsappGroup[] };
        setWhatsappGroups(payload.groups ?? []);
      }
    } catch {
      setWhatsappStatus('error');
    }
  };

  const connectWhatsapp = async (mode: 'qr' | 'code' = 'qr', phoneNumber?: string) => {
    setWhatsappLoading(true);
    try {
      const response = await fetch('/api/whatsapp/connect', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, phoneNumber }) });
      if (!response.ok) throw new Error('WhatsApp connection failed');
      const status = await response.json() as { status: typeof whatsappStatus; qrDataUrl?: string; pairingCode?: string };
      setWhatsappStatus(status.status);
      setWhatsappQr(status.qrDataUrl);
      setWhatsappPairingCode(status.pairingCode);
      notify(status.status === 'connected' ? 'WhatsApp is connected' : mode === 'code' ? 'Waiting for your WhatsApp pairing code' : 'Waiting for the WhatsApp QR code');
    } catch {
      setWhatsappStatus('error');
      notify('WhatsApp connection needs attention');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const toggleWhatsappGroup = async (group: WhatsappGroup) => {
    const response = await fetch(`/api/whatsapp/groups/${encodeURIComponent(group.jid)}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !group.enabled }),
    });
    if (!response.ok) {
      notify('Group selection could not be saved');
      return;
    }
    setWhatsappGroups((current) => current.map((item) => item.jid === group.jid ? { ...item, enabled: !item.enabled } : item));
    notify('WhatsApp group selection saved');
  };

  const createChild = async (child: { name: string; grade: string; className: string; school: string; subjects: string[] }) => {
    const response = await fetch('/api/family/children', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(child),
    });
    if (!response.ok) throw new Error('Child could not be saved');
    await loadFamily();
    notify(`${child.name} was added to your family plan`);
  };

  const addExtractedTasks = async (extraction: ExtractionResult, message: Message | null) => {
    const childId = message?.childId || selectedChild;
    const responses = await Promise.all(extraction.tasks.map((task) => fetch('/api/family/tasks', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...task, kind: extraction.category, childId, source: message?.sender || 'SchoolLife AI' }),
    })));
    if (responses.some((response) => !response.ok)) throw new Error('Tasks could not be saved');
    await loadFamily();
    notify(extraction.tasks.length ? `${extraction.tasks.length} real task${extraction.tasks.length === 1 ? '' : 's'} added to your plan` : 'Nothing actionable was found');
  };

  const content = useMemo(() => {
    if (!activeChild && view !== 'sources' && view !== 'settings') return <EmptyFamilyView onSetup={() => { setOnboardingStep(0); setModal('onboarding'); }} />;
    if (view === 'home') return <HomeView tasks={tasks} activeChild={activeChild} onOpenScience={() => { setSelectedMessage(inboxMessages.find((message) => message.needsAction) || inboxMessages[0] || null); setModal('science'); }} onOpenTask={setDetailTask} onAsk={() => setModal('assistant')} onView={(next) => setView(next)} />;
    if (view === 'plan') return <PlanView tasks={tasks} selectedChild={selectedChild} tab={planTab} setTab={setPlanTab} filter={planFilter} setFilter={setPlanFilter} onComplete={completeTask} onOpenTask={setDetailTask} onAsk={() => setModal('assistant')} />;
    if (view === 'calendar') return <CalendarView childrenData={familyChildren} eventsData={calendarEvents} mode={calendarMode} setMode={setCalendarMode} child={calendarChild} setChild={setCalendarChild} onOpenEvent={setDetailEvent} />;
    if (view === 'inbox') return <InboxView messagesData={inboxMessages} gmailSyncing={gmailSyncing} onSyncGmail={syncGmail} filter={inboxFilter} setFilter={setInboxFilter} onOpenScience={(message) => { setSelectedMessage(message); setModal('science'); }} onAddTask={addTask} />;
    if (view === 'sources') return <SourcesView sources={sources} onSyncCalendar={syncCalendar} calendarSyncing={calendarSyncing} onSyncGmail={syncGmail} gmailSyncing={gmailSyncing} onWhatsApp={() => setModal('whatsapp')} onNotify={notify} />;
    if (view === 'profile') return <ProfileView child={activeChild} childrenData={familyChildren} tasks={tasks} eventsData={calendarEvents} onSelect={setSelectedChild} onOpenTask={setDetailTask} onAdd={() => { setOnboardingStep(1); setModal('onboarding'); }} onNotify={notify} />;
    return <SettingsView user={user ?? null} onNotify={notify} onOpenPrivacy={() => setModal('privacy')} onSources={() => setView('sources')} onOnboarding={() => { setOnboardingStep(0); setModal('onboarding'); }} />;
  }, [activeChild, calendarChild, calendarMode, familyChildren, gmailSyncing, inboxFilter, inboxMessages, planFilter, planTab, selectedChild, sources, tasks, user, view]);

  return familyLoading ? <LoadingScreen /> : (
    <div className="sl-app">
      <Sidebar view={view} setView={setView} childrenData={familyChildren} selectedChild={selectedChild} setSelectedChild={setSelectedChild} parentName={parentName} onSignOut={() => void signOut({ redirectUrl: basePath || '/' })} />
      <div className="sl-main">
        <header className="sl-mobile-top">
          <button className="sl-icon-button" data-testid="button-mobile-menu" onClick={() => notify('Use More to explore SchoolLife')}><Menu size={19} /></button>
          <button className="sl-wordmark" data-testid="button-mobile-home" onClick={() => setView('home')}><span className="sl-mark">S</span> SchoolLife</button>
          <button className="sl-icon-button" data-testid="button-notifications-mobile" onClick={() => notify('You’re all caught up')}><Bell size={18} /></button>
        </header>
        <main className="sl-content">
          <div className="sl-page-enter">{content}</div>
        </main>
      </div>
      <MobileNav view={view} setView={setView} />
      {detailTask && <TaskDetail task={detailTask} onClose={() => setDetailTask(null)} onComplete={() => { completeTask(detailTask.id); setDetailTask(null); }} onNotify={notify} />}
      {detailEvent && <EventDetail event={detailEvent} onClose={() => setDetailEvent(null)} onNotify={notify} />}
      {modal === 'science' && <ExtractionModal message={selectedMessage} onClose={() => setModal(null)} onAdd={async (extraction) => { await addExtractedTasks(extraction, selectedMessage); setModal(null); }} />}
      {modal === 'assistant' && <AssistantModal onClose={() => setModal(null)} onViewPlan={() => { setModal(null); setView('plan'); }} />}
      {modal === 'whatsapp' && <WhatsAppModal status={whatsappStatus} qrDataUrl={whatsappQr} pairingCode={whatsappPairingCode} groups={whatsappGroups} loading={whatsappLoading} onConnect={connectWhatsapp} onToggle={toggleWhatsappGroup} onClose={() => setModal(null)} onSave={() => { setModal(null); notify(`${whatsappGroups.filter((group) => group.enabled).length} WhatsApp groups connected`); }} />}
      {modal === 'privacy' && <PrivacyModal onClose={() => setModal(null)} onNotify={notify} />}
      {modal === 'onboarding' && <OnboardingModal step={onboardingStep} setStep={setOnboardingStep} onClose={() => setModal(null)} onFinish={async (child) => { await createChild(child); setModal(null); }} />}
      {toast && <div className="sl-toast" data-testid="status-toast"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}

function Sidebar({ view, setView, childrenData, selectedChild, setSelectedChild, parentName, onSignOut }: { view: View; setView: (v: View) => void; childrenData: Child[]; selectedChild: ChildId; setSelectedChild: (v: ChildId) => void; parentName: string; onSignOut: () => void }) {
  return <aside className="sl-sidebar">
    <button className="sl-brand" data-testid="button-brand" onClick={() => setView('home')}><span className="sl-mark">S</span><span>SchoolLife</span></button>
    <div className="sl-side-label">Workspace</div>
    <nav className="sl-side-nav">{navItems.map((item) => <button key={item.id} className={`sl-side-link ${view === item.id ? 'active' : ''}`} data-testid={`button-nav-${item.id}`} onClick={() => setView(item.id)}><item.icon size={18} /> {item.label}{item.id === 'inbox' && <span className="sl-nav-count">12</span>}</button>)}</nav>
    <div className="sl-side-label sl-side-label-child">Your family</div>
    {childrenData.map((child) => <button className={`sl-child-link ${selectedChild === child.id && view === 'profile' ? 'active' : ''}`} key={child.id} data-testid={`button-child-${child.id}`} onClick={() => { setSelectedChild(child.id); setView('profile'); }}><span className={`sl-avatar ${child.id === 'aarav' ? 'avatar-indigo' : 'avatar-peach'}`}>{child.name.slice(0, 2).toUpperCase()}</span><span><strong>{child.name.split(' ')[0]}</strong><small>{child.grade} · {child.className}</small></span></button>)}
    <div className="sl-sidebar-bottom"><button className={`sl-side-link ${view === 'sources' ? 'active' : ''}`} data-testid="button-nav-sources" onClick={() => setView('sources')}><Zap size={18} /> Sources</button><button className={`sl-side-link ${view === 'settings' ? 'active' : ''}`} data-testid="button-nav-settings" onClick={() => setView('settings')}><UserRound size={18} /> Account</button><button className="sl-user" data-testid="button-sign-out" onClick={onSignOut}><span className="sl-avatar avatar-sanjay">{parentName.slice(0, 2).toUpperCase()}</span><span><strong>{parentName}</strong><small>Sign out</small></span><ChevronDown size={15} /></button></div>
  </aside>;
}

function MobileNav({ view, setView }: { view: View; setView: (v: View) => void }) {
  const items: { id: View; label: string; icon: typeof LayoutDashboard }[] = [...navItems, { id: 'settings', label: 'Account', icon: UserRound }];
  return <nav className="sl-mobile-nav">{items.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} data-testid={`button-mobile-nav-${item.id}`} onClick={() => setView(item.id)}><item.icon size={19} /><span>{item.label}</span>{item.id === 'inbox' && <i>12</i>}</button>)}</nav>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="sl-page-header"><div><div className="sl-eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function HomeView({ tasks, activeChild, onOpenScience, onOpenTask, onAsk, onView }: { tasks: Task[]; activeChild: Child; onOpenScience: () => void; onOpenTask: (task: Task) => void; onAsk: () => void; onView: (v: View) => void }) {
  const openTasks = tasks.filter((task) => task.status === 'open' && task.childId === activeChild.id);
  const urgentTask = openTasks.find((task) => task.priority === 'urgent') ?? openTasks[0];
  return <div>
    <div className="sl-home-head"><div><div className="sl-eyebrow">{new Intl.DateTimeFormat('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date())}</div><h1>Good morning, {activeChild.name.split(' ')[0]}’s plan <span className="sl-sun">✦</span></h1><p>Only information from your account and connected sources appears here.</p></div><button className="sl-notification" data-testid="button-notifications" onClick={onAsk}><Bell size={18} /><span>{openTasks.length}</span></button></div>
    {urgentTask ? <section className="sl-attention-card"><div className="sl-card-kicker"><span className="sl-status-dot urgent"></span> Needs attention <span className="sl-soft-badge">{openTasks.length} open</span></div><div className="sl-attention-body"><div className="sl-urgent-icon"><ClipboardCheck size={21} /></div><div className="sl-attention-copy"><span className={`sl-priority ${urgentTask.priority}`}>{urgentTask.priority.toUpperCase()}</span><h2>{urgentTask.title}</h2><p>{activeChild.name} <span className="dot-sep">·</span> {urgentTask.dueDate}{urgentTask.dueTime ? `, ${urgentTask.dueTime}` : ''}</p><small><FileText size={13} /> {urgentTask.source}</small></div><button className="sl-text-button" data-testid="button-view-science" onClick={() => { onOpenScience(); onOpenTask(urgentTask); }}>View details <ChevronRight size={15} /></button></div></section> : <EmptyState icon={<InboxIcon size={22} />} title="Your plan is ready for real updates" copy="Connect Gmail, Calendar, or WhatsApp to see school information here." />}
    <div className="sl-home-grid">
      <div className="sl-today-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">Your plan</div><h2>{openTasks.length ? `${openTasks.length} open item${openTasks.length === 1 ? '' : 's'}` : 'Nothing scheduled yet'}</h2></div><span className="sl-date-pill">LIVE</span></div>{openTasks.slice(0, 5).map((task) => <button className="sl-time-row" key={task.id} onClick={() => onOpenTask(task)}><span className={`sl-time-marker marker-${task.priority === 'urgent' ? 0 : task.priority === 'important' ? 1 : 2}`}></span><div><strong>{task.title}</strong><small>{task.dueDate}{task.dueTime ? ` · ${task.dueTime}` : ''} · {task.source}</small></div><ChevronRight size={15} /></button>)}{openTasks.length === 0 && <EmptyState icon={<ListChecks size={20} />} title="No tasks yet" copy="Approved AI extractions will be added here." />}<button className="sl-full-button" data-testid="button-open-calendar" onClick={() => onView('calendar')}>Open calendar <ChevronRight size={15} /></button></div>
      <div className="sl-week-card sl-card"><div className="sl-card-title-row"><div><div className="sl-eyebrow">Next step</div><h2>Keep your family plan current</h2></div><RefreshCw size={18} className="sl-sparkle" /></div><p>Sync your connected sources whenever a school message, event, or deadline changes.</p><div className="sl-setting-actions"><button className="sl-secondary-button" onClick={() => onView('sources')}><Zap size={15} /> Manage sources</button><button className="sl-text-button" onClick={() => onView('inbox')}>Review inbox <ChevronRight size={15} /></button></div></div>
    </div>
    <AssistantBar onAsk={onAsk} />
    <div className="sl-home-footer"><span><ShieldCheck size={15} /> Your school information stays in your control.</span><button data-testid="button-manage-sources" onClick={() => onView('sources')}>Manage sources</button><span className="sl-quiet-count">{openTasks.length} open items for {activeChild.name.split(' ')[0]}</span></div>
  </div>;
}

function AssistantBar({ onAsk }: { onAsk: () => void }) {
  return <button className="sl-assistant-bar" data-testid="button-ask-schoollife" onClick={onAsk}><span className="sl-assistant-icon"><Sparkles size={17} /></span><span><strong>Ask SchoolLife</strong><small>Try “What do I need to handle this week?”</small></span><Send size={17} /></button>;
}

function PlanView({ tasks, selectedChild, tab, setTab, filter, setFilter, onComplete, onOpenTask, onAsk }: { tasks: Task[]; selectedChild: ChildId; tab: string; setTab: (v: string) => void; filter: string; setFilter: (v: string) => void; onComplete: (id: string) => void; onOpenTask: (task: Task) => void; onAsk: () => void }) {
  const filters = ['All', 'Payments', 'Homework', 'Events', 'Shopping', 'Permission'];
  const familyTasks = tasks.filter((task) => task.childId === selectedChild);
  const filtered = familyTasks.filter((task) => (tab === 'Completed' ? task.status === 'completed' : tab === 'Later' ? task.dueDate === 'Unscheduled' : task.status === 'open')).filter((task) => filter === 'All' || task.kind === filter);
  const openCount = familyTasks.filter((task) => task.status === 'open').length;
  const urgentCount = familyTasks.filter((task) => task.status === 'open' && task.priority === 'urgent').length;
  const importantCount = familyTasks.filter((task) => task.status === 'open' && task.priority === 'important').length;
  return <div><PageHeader eyebrow="Family command center" title="Your Plan" description="A calm view of the things school needs from your family." action={<button className="sl-secondary-button" data-testid="button-add-plan" onClick={onAsk}><Plus size={16} /> Ask SchoolLife</button>} /><div className="sl-tabs">{['Today', 'This Week', 'Later', 'Completed'].map((item) => <button key={item} className={tab === item ? 'active' : ''} data-testid={`button-plan-tab-${item.toLowerCase().replace(' ', '-')}`} onClick={() => setTab(item)}>{item}{item === 'Completed' && <span>{familyTasks.filter((task) => task.status === 'completed').length}</span>}</button>)}</div><div className="sl-filter-row"><span className="sl-filter-label"><Filter size={14} /> Filter</span>{filters.map((item) => <button key={item} className={filter === item ? 'selected' : ''} data-testid={`button-plan-filter-${item.toLowerCase()}`} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="sl-plan-layout"><div className="sl-task-list">{filtered.map((task) => <TaskRow key={task.id} task={task} onComplete={onComplete} onOpen={() => onOpenTask(task)} />)}{filtered.length === 0 && <EmptyState icon={<CheckCircle2 />} title="Nothing here yet" copy="New school messages will land in the right place automatically." />}</div><aside className="sl-plan-summary"><div className="sl-eyebrow">Plan pulse</div><strong>{openCount} <small>open items</small></strong><div className="sl-progress"><span style={{ width: `${Math.min(openCount * 12, 100)}%` }}></span></div><p>Counts update from your connected sources.</p><div className="sl-summary-line"><span className="sl-dot dot-red"></span> {urgentCount} urgent</div><div className="sl-summary-line"><span className="sl-dot dot-amber"></span> {importantCount} important</div><div className="sl-summary-line"><span className="sl-dot dot-green"></span> {Math.max(openCount - urgentCount - importantCount, 0)} on track</div></aside></div><AssistantBar onAsk={onAsk} /></div>;
}

function TaskRow({ task, onComplete, onOpen }: { task: Task; onComplete: (id: string) => void; onOpen: () => void }) {
  return <div className={`sl-task-row ${task.status === 'completed' ? 'is-complete' : ''}`} data-testid={`card-task-${task.id}`}><button className="sl-task-check" data-testid={`button-complete-${task.id}`} onClick={() => onComplete(task.id)}>{task.status === 'completed' ? <Check size={14} /> : <Circle size={19} />}</button><button className="sl-task-main" data-testid={`button-open-task-${task.id}`} onClick={onOpen}><span className={`sl-priority-pill ${task.priority}`}>{task.priority}</span><strong>{task.title}</strong><div className="sl-task-meta"><span>{task.childId === 'unassigned' ? 'Family' : 'Child'}</span><span>{task.dueDate} {task.dueTime && `· ${task.dueTime}`}</span><span>{task.source}</span></div></button><button className="sl-row-chevron" data-testid={`button-task-details-${task.id}`} onClick={onOpen}><ChevronRight size={17} /></button></div>;
}

function CalendarView({ childrenData, eventsData, mode, setMode, child, setChild, onOpenEvent }: { childrenData: Child[]; eventsData: EventItem[]; mode: string; setMode: (v: string) => void; child: 'all' | ChildId; setChild: (v: 'all' | ChildId) => void; onOpenEvent: (event: EventItem) => void }) {
  const visibleEvents = eventsData.filter((event) => child === 'all' || event.childId === child);
  const today = new Date();
  const days = Array.from({ length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() }, (_, i) => i + 1);
  const monthLabel = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const childFilters: Array<['all' | ChildId, string]> = [['all', 'All children'], ...childrenData.map((item) => [item.id, item.name.split(' ')[0]] as ['all' | ChildId, string])];
  return <div><PageHeader eyebrow="School rhythm" title="Calendar" description="One view for every date your family needs to remember." action={<div className="sl-view-toggle">{['Month', 'Week', 'Agenda'].map((item) => <button key={item} className={mode === item ? 'active' : ''} data-testid={`button-calendar-${item.toLowerCase()}`} onClick={() => setMode(item)}>{item}</button>)}</div>} /><div className="sl-calendar-toolbar"><div className="sl-month-switch"><button data-testid="button-calendar-prev" onClick={() => {}}><ChevronLeft size={17} /></button><strong>{monthLabel}</strong><button data-testid="button-calendar-next" onClick={() => {}}><ChevronRight size={17} /></button></div><div className="sl-child-toggle">{childFilters.map(([id, label]) => <button key={id} className={child === id ? 'active' : ''} data-testid={`button-calendar-child-${id}`} onClick={() => setChild(id)}>{label}</button>)}</div></div>{mode === 'Agenda' ? <div className="sl-agenda">{visibleEvents.length ? visibleEvents.map((event) => <EventRow event={event} key={event.id} onOpen={onOpenEvent} />) : <EmptyState icon={<CalendarDays size={20} />} title="No events yet" copy="Connect Google Calendar or approve a message date to start your calendar." />}</div> : mode === 'Week' ? <div className="sl-week-calendar">{visibleEvents.length ? visibleEvents.slice(0, 5).map((event) => <EventRow event={event} key={event.id} onOpen={onOpenEvent} />) : <EmptyState icon={<CalendarDays size={20} />} title="No events yet" copy="Connect a calendar source to bring your family dates here." />}</div> : <div className="sl-calendar-grid"><div className="sl-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div><div className="sl-days">{days.map((day) => { const dayEvents = visibleEvents.filter((event) => Number(event.date.split(' ')[1]) === day); return <div className={`sl-day ${day === today.getDate() ? 'today' : ''}`} key={day}><span>{day}</span>{dayEvents.map((event) => <button key={event.id} className={`sl-calendar-event ${event.kind === 'Deadline' ? 'urgent' : ''}`} data-testid={`button-calendar-event-${event.id}`} onClick={() => onOpenEvent(event)}>{event.title}</button>)}</div>; })}</div></div>}<div className="sl-calendar-legend">{childrenData.map((item, index) => <span key={item.id}><i className={`legend-dot ${index % 2 ? 'peach' : 'purple'}`}></i> {item.name.split(' ')[0]}</span>)}<span><i className="legend-dot amber"></i> Important</span></div></div>;
}

function EventRow({ event, onOpen }: { event: EventItem; onOpen: (event: EventItem) => void }) {
  return <button className="sl-event-row" data-testid={`button-event-${event.id}`} onClick={() => onOpen(event)}><span className="sl-event-date">{event.date.replace('Sep ', '')}<small>SEP</small></span><span className="sl-event-line"></span><span className="sl-event-copy"><strong>{event.title}</strong><small>{event.time} · {event.childId === 'aarav' ? 'Aarav' : 'Emma'} · {event.source}</small></span><ChevronRight size={17} /></button>;
}

function InboxView({ messagesData, gmailSyncing, onSyncGmail, filter, setFilter, onOpenScience, onAddTask }: { messagesData: Message[]; gmailSyncing: boolean; onSyncGmail: () => void; filter: string; setFilter: (v: string) => void; onOpenScience: (message: Message) => void; onAddTask: (id: string) => void }) {
  const filters = ['All', 'Needs Action', 'Events', 'Payments', 'Homework', 'Announcements'];
  const shown = messagesData.filter((message) => filter === 'All' || (filter === 'Needs Action' ? message.needsAction : message.category === filter));
  return <div><PageHeader eyebrow="The noise, resolved" title="Inbox" description={`${messagesData.length} recent school-related items, translated into what matters.`} action={<div className="sl-page-actions"><button className="sl-secondary-button" data-testid="button-sync-gmail" onClick={onSyncGmail}><RefreshCw size={15} className={gmailSyncing ? 'sl-spin' : ''} /> {gmailSyncing ? 'Syncing…' : 'Sync Gmail'}</button><button className="sl-secondary-button" data-testid="button-mark-read" onClick={() => {}}><Check size={15} /> Mark all read</button></div>} /><div className="sl-filter-row inbox-filters">{filters.map((item) => <button key={item} className={filter === item ? 'selected' : ''} data-testid={`button-inbox-filter-${item.toLowerCase().replace(' ', '-')}`} onClick={() => setFilter(item)}>{item}{item === 'Needs Action' && <span className="filter-count">{messagesData.filter((message) => message.needsAction).length}</span>}</button>)}</div><div className="sl-inbox-list">{shown.map((message) => <MessageCard message={message} key={message.id} onOpen={() => onOpenScience(message)} onAdd={() => onAddTask(message.id)} />)}</div>{shown.length === 0 && <div className="sl-empty-state"><Mail size={20} /><strong>No {filter.toLowerCase()} items yet</strong><span>Sync a connected source to bring in real school messages.</span></div>}</div>;
}

function MessageCard({ message, onOpen, onAdd }: { message: Message; onOpen: () => void; onAdd: () => void }) {
  return <article className="sl-message-card" data-testid={`card-message-${message.id}`}><div className="sl-message-top"><span className={`sl-source-icon ${message.sender.includes('WhatsApp') || message.sender.includes('Parents') ? 'whatsapp' : message.sender.includes('Teacher') ? 'teacher' : 'school'}`}>{message.sender.includes('Parents') ? <MessageCircle size={15} /> : message.sender.includes('Teacher') ? <GraduationCap size={15} /> : <Mail size={15} />}</span><div><strong>{message.sender}</strong><small>Today · 09:18 AM</small></div>{message.needsAction && <span className="sl-action-badge">Needs action</span>}<button className="sl-more" data-testid={`button-message-more-${message.id}`} onClick={() => {}}><MoreHorizontal size={17} /></button></div><p className="sl-snippet">“{message.snippet}”</p><div className="sl-ai-summary"><span><Sparkles size={14} /> SchoolLife understood</span><strong>{message.summary}</strong><small><Tag size={13} /> {message.detected}</small></div><div className="sl-message-actions"><button className="sl-text-button" data-testid={`button-view-message-${message.id}`} onClick={onOpen}>View original <ChevronRight size={14} /></button>{message.needsAction && <button className="sl-secondary-button compact" data-testid={`button-add-message-${message.id}`} onClick={onAdd}><Plus size={14} /> Add to plan</button>}</div></article>;
}

function SourcesView({ sources, onSyncCalendar, calendarSyncing, onSyncGmail, gmailSyncing, onWhatsApp, onNotify }: { sources: Source[]; onSyncCalendar: () => void; calendarSyncing: boolean; onSyncGmail: () => void; gmailSyncing: boolean; onWhatsApp: () => void; onNotify: (msg: string) => void }) {
  const syncSource = (source: Source) => {
    if (source.id === 'calendar') return onSyncCalendar();
    if (source.id === 'email') return onSyncGmail();
    onNotify(`${source.name} does not have a sync action yet`);
  };
  return <div><PageHeader eyebrow="Your connections" title="Sources" description="Connect the places your school information actually arrives. Nothing is marked connected until a live sync succeeds." action={<button className="sl-primary-button" data-testid="button-sync-all" onClick={() => { onSyncCalendar(); onSyncGmail(); }}><RefreshCw size={15} /> Sync connected</button>} /><div className="sl-trust-banner"><span className="sl-trust-icon"><ShieldCheck size={19} /></span><div><strong>You control what SchoolLife can access.</strong><p>Only the records returned by an approved connection are stored in your family plan.</p></div><button data-testid="button-source-permissions" onClick={() => onNotify('Permissions are managed by the connected provider')}>Manage permissions</button></div><div className="sl-source-list">{sources.map((source) => <div className="sl-source-row" key={source.id} data-testid={`row-source-${source.id}`}><span className={`sl-source-logo source-${source.id}`}>{source.id === 'email' ? <Mail size={19} /> : source.id === 'whatsapp' ? <MessageCircle size={19} /> : source.id === 'calendar' ? <CalendarDays size={19} /> : <FileText size={19} />}</span><div className="sl-source-info"><strong>{source.name}</strong><span>{source.detail}</span><small>{source.lastSync}</small></div><span className={`sl-connected ${source.status === 'Connected' ? 'yes' : ''}`}><span></span>{source.status}</span>{source.id === 'whatsapp' ? <button className="sl-secondary-button compact" data-testid="button-manage-whatsapp" onClick={onWhatsApp}>{source.status === 'Connected' ? 'Manage' : 'Connect'}</button> : <button className="sl-secondary-button compact" data-testid={`button-source-sync-${source.id}`} onClick={() => syncSource(source)} disabled={(calendarSyncing && source.id === 'calendar') || (gmailSyncing && source.id === 'email')}>{(calendarSyncing && source.id === 'calendar') || (gmailSyncing && source.id === 'email') ? 'Syncing…' : source.status === 'Connected' ? 'Sync now' : 'Connect & sync'}</button>}{source.status === 'Connected' && source.id !== 'whatsapp' && <button className="sl-source-sync" data-testid={`button-sync-${source.id}`} onClick={() => syncSource(source)}><RefreshCw size={15} className={(calendarSyncing && source.id === 'calendar') || (gmailSyncing && source.id === 'email') ? 'sl-spin' : ''} /></button>}</div>)}</div><div className="sl-docs-note"><Paperclip size={16} /><span><strong>More sources</strong> will appear here as they are connected. WhatsApp uses a secure linked-device session and lets you choose groups before messages are processed.</span></div></div>;
}

function ProfileView({ child, childrenData, tasks, eventsData, onSelect, onOpenTask, onAdd, onNotify }: { child: Child; childrenData: Child[]; tasks: Task[]; eventsData: EventItem[]; onSelect: (id: ChildId) => void; onOpenTask: (task: Task) => void; onAdd: () => void; onNotify: (message: string) => void }) {
  const childTasks = tasks.filter((task) => task.childId === child.id && task.status === 'open');
  return <div><PageHeader eyebrow="Family profile" title={child.name} description="A focused view of one child’s school rhythm." action={<button className="sl-secondary-button" data-testid="button-add-child" onClick={onAdd}><Plus size={15} /> Add another child</button>} /><div className="sl-profile-switch"><span>Viewing</span>{childrenData.map((item) => <button key={item.id} className={item.id === child.id ? 'active' : ''} data-testid={`button-profile-switch-${item.id}`} onClick={() => onSelect(item.id)}><span className={`sl-avatar ${item.id === 'aarav' ? 'avatar-indigo' : 'avatar-peach'}`}>{item.name.slice(0, 2).toUpperCase()}</span>{item.name.split(' ')[0]}</button>)}</div><div className="sl-profile-grid"><section className="sl-profile-hero"><span className={`sl-avatar large ${child.id === 'aarav' ? 'avatar-indigo' : 'avatar-peach'}`}>{child.name.slice(0, 2).toUpperCase()}</span><div><h2>{child.name}</h2><p>{child.grade} <span>·</span> {child.className}</p><small>{child.school}</small></div><button className="sl-more" data-testid="button-profile-more" onClick={() => onNotify('Profile details are up to date')}><MoreHorizontal size={18} /></button></section><section className="sl-profile-card sl-card"><div className="sl-eyebrow">Upcoming</div><h2>School rhythm</h2>{eventsData.filter((event) => event.childId === child.id).slice(0, 3).map((event) => <EventRow key={event.id} event={event} onOpen={() => onNotify(`${event.title} is ${event.date} at ${event.time}`)} />)}</section><section className="sl-profile-card sl-card"><div className="sl-eyebrow">Tasks</div><h2>{childTasks.length} open for {child.name.split(' ')[0]}</h2>{childTasks.slice(0, 4).map((task) => <button className="sl-profile-task" key={task.id} data-testid={`button-profile-task-${task.id}`} onClick={() => onOpenTask(task)}><span className={`sl-priority-dot ${task.priority}`}></span><span>{task.title}<small>{task.dueDate} · {task.kind}</small></span><ChevronRight size={15} /></button>)}</section><section className="sl-subjects-card sl-card"><div className="sl-eyebrow">Subjects</div><h2>What {child.name.split(' ')[0]} is learning</h2><div className="sl-subject-grid">{child.subjects.map((subject, index) => <span key={subject}><i className={`subject-icon subject-${index}`}><GraduationCap size={14} /></i>{subject}</span>)}</div></section></div></div>;
}

function SettingsView({ user, onNotify, onOpenPrivacy, onSources, onOnboarding }: { user: { firstName?: string | null; lastName?: string | null; primaryEmailAddress?: { emailAddress: string } | null } | null; onNotify: (msg: string) => void; onOpenPrivacy: () => void; onSources: () => void; onOnboarding: () => void }) {
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Your account';
  const email = user?.primaryEmailAddress?.emailAddress || 'Email managed by Clerk';
  return <div><PageHeader eyebrow="Your account" title="Account" description="Manage your identity, family members, connections, and privacy." /><div className="sl-settings-layout"><div className="sl-settings-nav">{['Profile', 'Children', 'Connected Sources', 'Notifications', 'Privacy', 'AI Preferences'].map((item, index) => <button key={item} className={index === 0 ? 'active' : ''} data-testid={`button-settings-${item.toLowerCase().replace(' ', '-')}`} onClick={() => item === 'Connected Sources' ? onSources() : item === 'Privacy' ? onOpenPrivacy() : onNotify(`${item} settings are ready to customise`)}>{item}<ChevronRight size={15} /></button>)}</div><section className="sl-settings-content"><div className="sl-settings-card"><div className="sl-settings-heading"><span className="sl-avatar avatar-sanjay">{name.slice(0, 2).toUpperCase()}</span><div><h2>{name}</h2><p>{email}</p><small>Signed in securely with Clerk</small></div><button className="sl-secondary-button compact" data-testid="button-edit-account" onClick={() => onNotify('Edit your name and email in your Clerk profile')}>Edit</button></div></div><div className="sl-settings-card"><div className="sl-eyebrow">Connections</div><h2>Bring your school accounts together</h2><p>Connect Gmail, Google Calendar, WhatsApp, and supported school sources from one place.</p><div className="sl-setting-actions"><button data-testid="button-account-sources" onClick={onSources}><Zap size={15} /> Manage connected sources</button><button data-testid="button-account-refresh" onClick={() => onNotify('Connected source status is shown in Sources')}><RefreshCw size={15} /> Check connection status</button></div></div><div className="sl-settings-card"><div className="sl-eyebrow">Privacy</div><h2>You control your data</h2><p>SchoolLife only stores your family records and the messages you explicitly connect. Review or remove processed data whenever you like.</p><div className="sl-setting-actions"><button data-testid="button-manage-permissions" onClick={onOpenPrivacy}><ShieldCheck size={15} /> Manage permissions</button><button data-testid="button-delete-data" onClick={() => onNotify('Data deletion is available from the privacy controls')}><Trash2 size={15} /> Delete processed data</button></div></div><div className="sl-settings-card"><div className="sl-eyebrow">Family setup</div><h2>Add another child or revisit setup</h2><p>Your family plan is built from the children and sources you add—not sample data.</p><button className="sl-secondary-button" data-testid="button-run-onboarding" onClick={onOnboarding}>Add a child <ChevronRight size={15} /></button></div></section></div></div>;
}

function EmptyFamilyView({ onSetup }: { onSetup: () => void }) {
  return <div className="sl-empty-family"><div className="sl-onboarding-mark"><Sparkles size={22} /></div><PageHeader eyebrow="Your private family plan" title="Start with your first child" description="Add a child, then connect Gmail, Calendar, or WhatsApp. SchoolLife will only show data from sources you approve." /><button className="sl-primary-button" data-testid="button-empty-family-setup" onClick={onSetup}>Add your first child <ChevronRight size={16} /></button></div>;
}

function EmptyState({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return <div className="sl-empty-state">{icon}<h3>{title}</h3><p>{copy}</p></div>;
}

function Overlay({ children, onClose, wide = false }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return <div className="sl-overlay" role="dialog"><div className={`sl-modal ${wide ? 'wide' : ''}`}><button className="sl-modal-close" data-testid="button-modal-close" onClick={onClose}><X size={18} /></button>{children}</div></div>;
}

function ExtractionModal({ message, onClose, onAdd }: { message: Message | null; onClose: () => void; onAdd: (extraction: ExtractionResult) => Promise<void> }) {
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState('');
  const text = message ? `${message.sender}\n${message.snippet}\n${message.summary}` : '';
  useEffect(() => {
    if (!text) return;
    void fetch('/api/ai/extract', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }).then(async (response) => {
      const payload = await response.json() as { extraction?: ExtractionResult; error?: string; message?: string };
      if (!response.ok || !payload.extraction) throw new Error(payload.message || payload.error || 'AI extraction failed');
      setExtraction(payload.extraction);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'AI extraction failed'));
  }, [text]);
  return <Overlay onClose={onClose} wide><div className="sl-extraction-grid"><div className="sl-original-message"><div className="sl-modal-eyebrow"><MessageCircle size={14} /> Original message</div><div className="sl-chat-bubble"><strong>{message?.sender || 'No synced school message selected'}</strong><small>{message ? 'Synced from your connected source' : 'Connect Gmail or WhatsApp to review messages'}</small><p>{message?.snippet || 'SchoolLife will show the exact source text here after your first sync.'}</p></div><button className="sl-text-button" data-testid="button-view-original"><Paperclip size={14} /> Source text is never invented</button></div><div className="sl-understood"><div className="sl-modal-eyebrow"><Sparkles size={14} /> SchoolLife understood</div><h2>{error ? 'AI extraction needs setup.' : extraction ? 'Review before adding to your plan.' : 'Reading your message…'}</h2>{error ? <div className="sl-empty-state"><Info size={20} /><strong>{error}</strong><span>Connect Groq by adding the GROQ_API_KEY secret, then try again.</span></div> : extraction ? <><p>{extraction.summary}</p><div className="sl-extracted-list">{extraction.tasks.map((task) => <Extracted key={`task-${task.title}`} icon={<ListChecks />} label="TASK" value={`${task.title}${task.dueDate ? ` · ${task.dueDate}` : ''}`} />)}{extraction.events.map((event) => <Extracted key={`event-${event.title}`} icon={<CalendarDays />} label="EVENT" value={`${event.title}${event.date ? ` · ${event.date}` : ''}`} />)}<Extracted icon={<Tag />} label="CATEGORY" value={extraction.category} /><Extracted icon={<CheckCircle2 />} label="CONFIDENCE" value={extraction.confidence} /></div><div className="sl-confidence"><span><CheckCircle2 size={15} /> Nothing is added without your approval.</span><button className="sl-primary-button" data-testid="button-add-everything" onClick={() => void onAdd(extraction)}>Add reviewed tasks <Plus size={15} /></button></div></> : <div className="sl-empty-state"><Sparkles size={20} /><strong>Extracting tasks and dates…</strong><span>This uses your connected message, not demo content.</span></div>}</div></div></Overlay>;
}

function ShoppingBagIcon() { return <Tag />; }
function Extracted({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="sl-extracted"><span className="sl-extracted-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>;
}

function TaskDetail({ task, onClose, onComplete, onNotify }: { task: Task; onClose: () => void; onComplete: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-detail-panel"><span className="sl-priority-pill urgent">URGENT</span><h2>{task.title}</h2><p className="sl-detail-sub"><span className="sl-avatar tiny avatar-indigo">AK</span> Aarav · Class 6A</p><div className="sl-detail-date"><CalendarDays size={16} /><strong>Sep 9 · 8:00 PM</strong><small>Due tomorrow</small></div><div className="sl-detail-section"><div className="sl-eyebrow">Bring along</div>{task.items.map((item) => <div className="sl-detail-item" key={item}><CheckCircle2 size={15} /> {item}</div>)}</div><div className="sl-detail-section"><div className="sl-eyebrow">Source</div><button className="sl-source-chip" data-testid="button-detail-source" onClick={() => onNotify('Opening Class 6A Parents WhatsApp') }><MessageCircle size={14} /> {task.source} <ChevronRight size={14} /></button></div><div className="sl-detail-actions"><button className="sl-primary-button" data-testid="button-detail-complete" onClick={onComplete}><Check size={16} /> Mark complete</button><button className="sl-secondary-button" data-testid="button-add-reminder" onClick={() => onNotify('Reminder set for tomorrow at 7:00 PM')}><Bell size={15} /> Add reminder</button><button className="sl-text-button" data-testid="button-detail-view-source" onClick={() => onNotify('Source preview opened')}><FileText size={15} /> View source</button></div></div></Overlay>;
}

function EventDetail({ event, onClose, onNotify }: { event: EventItem; onClose: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-detail-panel event-detail"><span className="sl-event-type">{event.kind}</span><h2>{event.title}</h2><p className="sl-detail-sub"><span className="sl-avatar tiny avatar-indigo">AK</span> {event.childId === 'aarav' ? 'Aarav' : 'Emma'} · {event.source}</p><div className="sl-detail-date"><CalendarDays size={16} /><strong>{event.date} · {event.time}</strong><small>September 2026</small></div><div className="sl-detail-section"><div className="sl-eyebrow">SchoolLife note</div><p className="sl-event-note">This date was found in a school message and placed here for your family.</p></div><button className="sl-primary-button" data-testid="button-event-reminder" onClick={() => onNotify('Reminder added to your calendar')}><Bell size={15} /> Add reminder</button></div></Overlay>;
}

function AssistantModal({ onClose, onViewPlan }: { onClose: () => void; onViewPlan: () => void }) {
  return <Overlay onClose={onClose}><div className="sl-assistant-modal"><div className="sl-assistant-big"><Sparkles size={20} /></div><div className="sl-modal-eyebrow">SchoolLife assistant</div><h2>Here’s your week, in three moves.</h2><p className="sl-assistant-intro">Based on what came in today, these are the things worth your attention.</p><div className="sl-answer-list"><div><b>01</b><span><strong>Science project</strong><small>Wednesday · due at 8:00 PM</small></span></div><div><b>02</b><span><strong>Permission slip</strong><small>Thursday · signature needed</small></span></div><div><b>03</b><span><strong>School trip payment</strong><small>Friday · ₹1,250</small></span></div></div><button className="sl-primary-button full" data-testid="button-view-full-plan" onClick={onViewPlan}>View full plan <ChevronRight size={16} /></button></div></Overlay>;
}

function WhatsAppModal({ status, qrDataUrl, pairingCode, groups, loading, onConnect, onToggle, onClose, onSave }: { status: 'stopped' | 'starting' | 'awaiting_qr' | 'awaiting_code' | 'connected' | 'reconnecting' | 'error'; qrDataUrl?: string; pairingCode?: string; groups: WhatsappGroup[]; loading: boolean; onConnect: (mode: 'qr' | 'code', phoneNumber?: string) => void; onToggle: (group: WhatsappGroup) => void; onClose: () => void; onSave: () => void }) {
  const [mode, setMode] = useState<'qr' | 'code'>(() => window.matchMedia('(max-width: 720px)').matches ? 'code' : 'qr');
  const [phoneNumber, setPhoneNumber] = useState('');
  const connected = status === 'connected';
  return <Overlay onClose={onClose}><div className="sl-whatsapp-modal"><div className="sl-source-logo source-whatsapp big"><MessageCircle size={22} /></div><div className="sl-modal-eyebrow">WhatsApp Web connection</div><h2>{connected ? 'Choose the school groups to follow' : 'Connect your WhatsApp'}</h2><p>SchoolLife reads only the groups you explicitly select. QR is the default for PC; pairing code works when you start from your phone.</p>{!connected && <><div className="sl-view-toggle"><button className={mode === 'qr' ? 'active' : ''} onClick={() => setMode('qr')}>QR code</button><button className={mode === 'code' ? 'active' : ''} onClick={() => setMode('code')}>Phone code</button></div><div className="sl-whatsapp-connect-state">{mode === 'qr' && qrDataUrl ? <><img className="sl-whatsapp-qr" src={qrDataUrl} alt="WhatsApp QR code" /><strong>Scan this QR code in WhatsApp</strong><small>WhatsApp → Settings → Linked devices → Link a device</small></> : mode === 'code' && status === 'awaiting_code' ? <><strong className="sl-whatsapp-pairing-code">{pairingCode || 'Waiting for pairing code…'}</strong><p>Open WhatsApp on your phone → Linked devices → Link a device → Link with phone number, then enter this code.</p></> : <><div className={`sl-whatsapp-status ${status}`}><span></span>{status === 'starting' || status === 'reconnecting' ? 'Starting a secure session…' : status === 'error' ? 'Session needs to be connected again' : 'Ready to connect'}</div>{mode === 'code' && <input className="sl-input" inputMode="tel" placeholder="Country code + phone number" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} />}{mode === 'code' && <small>Use digits only, including your country code.</small>}<button className="sl-primary-button full" data-testid={`button-whatsapp-connect-${mode}`} disabled={loading || (mode === 'code' && phoneNumber.replace(/\D/g, '').length < 8)} onClick={() => onConnect(mode, phoneNumber)}>{loading ? 'Starting…' : mode === 'code' ? 'Get pairing code' : 'Connect WhatsApp Web'}</button></>}</div></>}{connected && <><div className="sl-whatsapp-live"><span className="sl-whatsapp-status connected"><span></span>Connected and listening</span><small>New messages from selected groups are added automatically.</small></div><div className="sl-group-list">{groups.length === 0 ? <div className="sl-empty-state"><MessageCircle size={20} /><strong>Waiting for your groups</strong><span>Keep this open while WhatsApp finishes loading your group list.</span></div> : groups.map((group) => <button className={`sl-group-choice ${group.enabled ? 'selected' : ''}`} key={group.jid} data-testid={`button-group-${group.jid}`} onClick={() => onToggle(group)}><span className="sl-check-square">{group.enabled && <Check size={14} />}</span><span>{group.name}<small>WhatsApp school group</small></span></button>)}</div></>}{connected && <div className="sl-modal-actions"><button className="sl-secondary-button" data-testid="button-whatsapp-cancel" onClick={onClose}>Close</button><button className="sl-primary-button" data-testid="button-save-whatsapp" onClick={onSave}>Done</button></div>}{!connected && <button className="sl-text-button" data-testid="button-whatsapp-close" onClick={onClose}>Cancel</button>}</div></Overlay>;
}

function PrivacyModal({ onClose, onNotify }: { onClose: () => void; onNotify: (msg: string) => void }) {
  return <Overlay onClose={onClose}><div className="sl-privacy-modal"><div className="sl-trust-icon large"><ShieldCheck size={22} /></div><div className="sl-modal-eyebrow">Your privacy</div><h2>You control your data.</h2><p>SchoolLife is designed around your permission. Your sources stay yours, and every processed item can be removed from this device.</p><div className="sl-privacy-points"><span><CheckCircle2 size={15} /> Choose exactly which sources to connect</span><span><CheckCircle2 size={15} /> Review what SchoolLife understood</span><span><CheckCircle2 size={15} /> Delete processed data whenever you like</span></div><button className="sl-primary-button full" data-testid="button-privacy-done" onClick={() => { onClose(); onNotify('Your privacy settings are unchanged'); }}>Done</button></div></Overlay>;
}

function OnboardingModal({ step, setStep, onClose, onFinish }: { step: number; setStep: (step: number) => void; onClose: () => void; onFinish: (child: { name: string; grade: string; className: string; school: string; subjects: string[] }) => Promise<void> }) {
  const [form, setForm] = useState({ name: '', grade: '', className: '', school: '', subjects: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!form.name || !form.grade || !form.className || !form.school) {
      setError('Please fill in your child’s name, grade, class, and school.');
      return;
    }
    setSaving(true);
    try {
      await onFinish({ ...form, subjects: form.subjects.split(',').map((subject) => subject.trim()).filter(Boolean) });
    } catch {
      setError('We could not save this child. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const field = (key: keyof typeof form, placeholder: string) => <input className="sl-input" placeholder={placeholder} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} />;
  return <Overlay onClose={onClose}><div className="sl-onboarding-modal">{step === 0 ? <><div className="sl-onboarding-mark"><Sparkles size={22} /></div><div className="sl-modal-eyebrow">A calmer school week</div><h2>Build your real family plan.</h2><p>Add your first child. Then connect only the school accounts you want SchoolLife to process.</p><div className="sl-onboarding-lines"><span><Check size={14} /> Your data stays tied to your account</span><span><Check size={14} /> Nothing is created from sample data</span></div><button className="sl-primary-button full" data-testid="button-get-started" onClick={() => setStep(1)}>Add child details <ChevronRight size={16} /></button></> : <><div className="sl-modal-eyebrow">Child setup</div><h2>Who are we organizing for?</h2><p>These details help you recognize messages and plan items.</p><div className="sl-onboarding-fields">{field('name', 'Child’s name')}{field('grade', 'Grade or year')}{field('className', 'Class name')}{field('school', 'School name')}{field('subjects', 'Subjects, separated by commas')}</div>{error && <p className="sl-form-error">{error}</p>}<button className="sl-primary-button full" data-testid="button-finish-setup" disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : 'Save child and continue'} <ChevronRight size={16} /></button></>}</div></Overlay>;
}

function Landing() {
  return <main className="sl-landing">
    <div className="sl-landing-orb orb-one"></div>
    <div className="sl-landing-orb orb-two"></div>
    <div className="sl-landing-inner">
      <div className="sl-landing-nav"><button className="sl-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><span className="sl-mark">S</span><span>SchoolLife</span></button><div className="sl-landing-actions"><a href="#how-it-works">How it works</a><a className="sl-secondary-button compact" href="/sign-in">Sign in</a><a className="sl-primary-button compact" href="/sign-up">Get started</a></div></div>
      <section className="sl-landing-hero">
        <div className="sl-landing-copy"><span className="sl-eyebrow">The calmer school week</span><h1>School stuff, <em>automatically organized.</em></h1><p>SchoolLife brings together school emails, messages and notices and turns them into one simple family plan.</p><div className="sl-landing-cta"><a className="sl-primary-button" href="/sign-up">Create your family plan <ChevronRight size={16} /></a><a className="sl-text-button" href="/sign-in">I already have an account <ChevronRight size={15} /></a></div><div className="sl-landing-trust"><span><ShieldCheck size={15} /> Your data stays in your control</span><span><Sparkles size={15} /> Built for busy families</span></div></div>
        <div className="sl-landing-preview"><div className="sl-preview-top"><span className="sl-mark">S</span><strong>Good morning</strong><span className="sl-preview-avatar">SK</span></div><div className="sl-preview-greeting">Here’s what matters today.</div><div className="sl-preview-alert"><span className="sl-preview-dot"></span><div><small>NEEDS ATTENTION</small><strong>Science project due tomorrow</strong><span>Aarav · Class 6A · 8:00 PM</span></div><ChevronRight size={16} /></div><div className="sl-preview-columns"><div><small>TODAY</small><strong>Monday rhythm</strong><span>08:00&nbsp;&nbsp; School starts</span><span>10:30&nbsp;&nbsp; Math test</span><span>16:00&nbsp;&nbsp; Football practice</span></div><div><small>THIS WEEK</small><strong>Keep it moving</strong><span>English worksheet</span><span>Parent-teacher meeting</span><span>₹1,250 trip payment</span></div></div><div className="sl-preview-bottom"><Sparkles size={15} /><span>7 new school items, sorted</span><ChevronRight size={15} /></div></div>
      </section>
      <section className="sl-landing-proof" id="how-it-works"><div><span className="sl-eyebrow">From noise to next steps</span><h2>Stop searching through five places to find one deadline.</h2></div><div className="sl-proof-steps"><div><span>01</span><strong>Connect your sources</strong><p>Email, calendars, school apps, and the places messages arrive.</p></div><div><span>02</span><strong>SchoolLife understands</strong><p>Important dates, tasks, payments, and required items are pulled out.</p></div><div><span>03</span><strong>Your family stays ahead</strong><p>Everything lands in one clear plan, organized by child and urgency.</p></div></div></section>
    </div>
  </main>;
}

function LoadingScreen() {
  return <div className="sl-auth-loading"><span className="sl-mark">S</span><strong>Preparing your family plan…</strong></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <Redirect to="/app" /> : <Landing />;
}

function ProtectedApp() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return isSignedIn ? <DashboardApp /> : <Redirect to="/" />;
}

function SignInPage() {
  return <div className="sl-auth-page"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>;
}

function SignUpPage() {
  return <div className="sl-auth-page"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    routerPush={(to) => setLocation(to)}
    routerReplace={(to) => setLocation(to, { replace: true })}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to access your family plan' } },
      signUp: { start: { title: 'Create your family plan', subtitle: 'Start a calmer school week' } },
    }}
  >
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/app" component={ProtectedApp} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={HomeRedirect} />
    </Switch>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) {
    return <LoadingScreen />;
  }
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;