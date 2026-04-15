import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_KEY = 'kri_tour_completed';

const STEPS = [
  {
    popover: {
      title: '👋 Welcome to BIDCO Route Intelligence',
      description:
        'This dashboard gives you a real-time view of field operations across Kenya — 95 reps, 9 user groups, and 79,000+ customers. This quick tour will walk you through each section.',
      side: 'over' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="statsbar"]',
    popover: {
      title: 'Key Metrics',
      description:
        'At a glance: total customer universe, unique shops visited, active field staff, average visit duration (minutes), and national coverage percentage. These update based on whatever filter or rep you have selected.',
      side: 'bottom' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="universe"]',
    popover: {
      title: 'Customer Universe',
      description:
        'The total customer base broken down by tier — Distributors, Key Accounts, Hubs, Stockists, Modern Trade, and General Trade. <strong>Click any tier</strong> to highlight those customers on the map with their colour-coded markers.',
      side: 'bottom' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="filterbar"]',
    popover: {
      title: 'Filters',
      description:
        'Narrow the view by <strong>User Group</strong> (e.g. BIDCO RTM, TTMS) or adjust the <strong>date range</strong>. Selecting a user group filters the leaderboard and map to only that group\'s reps.',
      side: 'bottom' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="map"]',
    popover: {
      title: 'Interactive Map',
      description:
        'Every field rep is plotted on the map, colour-coded by user group. <strong>Click a rep\'s dot</strong> to fly to their region, see all shops they\'ve visited (sized by visit frequency), and trace their route lines.',
      side: 'left' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="leaderboard"]',
    popover: {
      title: 'Performance Leaderboard',
      description:
        'All 95 reps ranked side-by-side. Switch between <strong>Visits, Shops, Coverage,</strong> and <strong>V/Day</strong> tabs to re-sort. The gold left border marks the top performer. <strong>Click any row</strong> to select that rep and load their detail view.',
      side: 'left' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="layers"]',
    popover: {
      title: 'Map Layers',
      description:
        'Toggle which data layers appear on the map — field staff markers, the full customer universe (by tier), route lines, county boundaries, and a visit heatmap. Mix and match to build the exact view you need.',
      side: 'top' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="askai"]',
    popover: {
      title: 'Ask AI',
      description:
        'Have a question about coverage gaps, rep performance, or route efficiency? Type it here and get an instant analysis grounded in the data you\'re looking at.',
      side: 'top' as const,
      align: 'end' as const,
    },
  },
  {
    popover: {
      title: "You're all set 🎉",
      description:
        'Start by clicking a rep in the leaderboard, or click a tier in the customer universe to see who\'s covering what. You can replay this tour anytime from the <strong>Tour</strong> button in the top-right.',
      side: 'over' as const,
      align: 'center' as const,
    },
  },
];

interface OnboardingTourProps {
  triggerRef: React.MutableRefObject<(() => void) | null>;
}

export default function OnboardingTour({ triggerRef }: OnboardingTourProps) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    driverRef.current = driver({
      showProgress: true,
      progressText: '{{current}} of {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Done',
      steps: STEPS,
      popoverClass: 'kri-tour-popover',
      onDestroyStarted: () => {
        localStorage.setItem(TOUR_KEY, '1');
        driverRef.current?.destroy();
      },
    });

    // Expose trigger to parent (for the Navbar button)
    triggerRef.current = () => driverRef.current?.drive();

    // Auto-launch on first visit
    if (!localStorage.getItem(TOUR_KEY)) {
      // Small delay so the map tiles have a moment to load
      const t = setTimeout(() => driverRef.current?.drive(), 800);
      return () => clearTimeout(t);
    }
  }, [triggerRef]);

  return null;
}
