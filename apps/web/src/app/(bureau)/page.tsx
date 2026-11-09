import { permissions } from '@preuvio/shared';
import { Suspense } from 'react';
import { JobsiteMap } from '@/components/JobsiteMap';
import { Tiles } from '@/components/Tiles';
import { TodoList } from '@/components/TodoList';
import { jobsiteView, tiles, todoItems } from '@/lib/dashboard';
import { currentUser } from '@/lib/dal';
import { loadDashboard } from '@/lib/queries';

export const metadata = { title: 'Tableau de bord · Preuvio' };

async function Dashboard() {
  const [user, data] = await Promise.all([currentUser(), loadDashboard()]);
  const views = data.jobsites.map((j) => jobsiteView(j, data.today));
  const pins = views
    .filter((v) => v.today && v.lat !== null && v.lng !== null)
    .map((v) => ({ id: v.id, label: v.label, lat: v.lat!, lng: v.lng!, state: v.state }));
  return (
    <>
      <Tiles tiles={tiles(data.jobsites, data.batches, data.threshold, data.today)} />
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">À traiter</h2>
        <TodoList
          items={todoItems(data.jobsites, data.notes)}
          canDecide={permissions(user.role).decide}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold">Chantiers du jour</h2>
        <JobsiteMap pins={pins} />
      </section>
    </>
  );
}

export default function Home() {
  return (
    <>
      <h1 className="text-[32px] font-bold">Tableau de bord</h1>
      <Suspense fallback={<p className="text-text-muted">Chargement…</p>}>
        <Dashboard />
      </Suspense>
    </>
  );
}
