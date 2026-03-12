import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import Overview from '@/pages/Overview';
import ChannelDetail from '@/pages/ChannelDetail';
import Channels from '@/pages/Channels';
import Strategist from '@/pages/Strategist';
import Comparison from '@/pages/Comparison';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="channels" element={<Channels />} />
          <Route path="channel/:id" element={<ChannelDetail />} />
          <Route path="comparison" element={<Comparison />} />
          <Route path="strategist" element={<Strategist />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
