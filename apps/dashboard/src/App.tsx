import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import Overview from '@/pages/Overview';
import ChannelDetail from '@/pages/ChannelDetail';
import Strategist from '@/pages/Strategist';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="channel/:id" element={<ChannelDetail />} />
          <Route path="strategist" element={<Strategist />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
