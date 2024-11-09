import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Sparkles, Activity, Settings as SettingsIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";

const HASS_URL = 'https://hass.mdu-smartroom.se';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI3MGY3MTc2ODQyZmE0OWE4OTg2Yjc1OTNhMDlhNjkwZCIsImlhdCI6MTcyNzUwODU4OSwiZXhwIjoyMDQyODY4NTg5fQ.o2dHhF0tcaBDzeemFtYXP3k0R9Z_OuwF3DeYXLkQ1Sk';

const EntityDashboard = () => {
  const [entities, setEntities] = useState({});
  const [aiEnabled, setAiEnabled] = useState(true);
  const [status, setStatus] = useState({ message: 'Connecting to Home Assistant...', isError: false });
  const [ws, setWs] = useState(null);
  const [reconnectTimer, setReconnectTimer] = useState(null);
  
  // Settings state with localStorage persistence
  const [settings, setSettings] = useState(() => {
    const savedSettings = localStorage.getItem('dashboardSettings');
    return savedSettings ? JSON.parse(savedSettings) : {
      refreshInterval: "30",
      theme: "light",
      displayMode: "card",
      notificationsEnabled: true,
      autoReconnect: true
    };
  });

  // Historical data state
  const [historicalData, setHistoricalData] = useState([
    { month: 'Jan', activeEntities: 4, suggestions: 8 },
    { month: 'Feb', activeEntities: 6, suggestions: 12 },
    { month: 'Mar', activeEntities: 5, suggestions: 10 },
    { month: 'Apr', activeEntities: 8, suggestions: 15 },
  ]);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (settings.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Handle refresh interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          id: Math.floor(Math.random() * 1000) + 1,
          type: "get_states"
        }));
      }
    }, parseInt(settings.refreshInterval) * 1000);

    return () => clearInterval(interval);
  }, [settings.refreshInterval, ws]);

  // Handle notifications
  useEffect(() => {
    if (settings.notificationsEnabled) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
  }, [settings.notificationsEnabled]);

  const showNotification = (title, body) => {
    if (settings.notificationsEnabled && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  };

  const updateEntityState = useCallback((entityId, newState) => {
    setEntities(prev => ({
      ...prev,
      [entityId]: {
        ...prev[entityId],
        state: newState.state,
        attributes: newState.attributes
      }
    }));

    if (settings.notificationsEnabled) {
      showNotification(
        'Entity State Changed',
        `${entityId} is now ${newState.state}`
      );
    }
  }, [settings.notificationsEnabled]);

  const connectWebSocket = useCallback(() => {
    if (ws) {
      ws.close();
    }

    const wsConnection = new WebSocket(`wss://hass.mdu-smartroom.se/api/websocket`);

    wsConnection.onopen = () => {
      setStatus({ message: 'WebSocket connected, authenticating...', isError: false });
      wsConnection.send(JSON.stringify({
        type: "auth",
        access_token: TOKEN
      }));
    };

    wsConnection.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case 'auth_ok':
          setStatus({ message: 'Authentication successful, loading entities...', isError: false });
          wsConnection.send(JSON.stringify({
            id: 1,
            type: "get_states"
          }));
          break;

        case 'result':
          if (message.id === 1) {
            const entityMap = {};
            message.result.forEach(entity => {
              const domain = entity.entity_id.split(".")[0];
              if (!entityMap[domain]) {
                entityMap[domain] = {};
              }
              entityMap[domain][entity.entity_id] = entity;
            });
            setEntities(entityMap);
            setStatus({ message: 'Connected to Home Assistant', isError: false });
          }
          break;

        case 'event':
          if (message.event?.data) {
            updateEntityState(message.event.data.entity_id, message.event.data.new_state);
          }
          break;

        case 'auth_invalid':
          setStatus({ message: 'Authentication failed. Please check your token.', isError: true });
          break;
      }
    };

    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus({ message: 'Connection error. Please try again.', isError: true });
    };

    wsConnection.onclose = () => {
      setStatus({ message: 'Connection closed.', isError: true });
      if (settings.autoReconnect) {
        setStatus({ message: 'Connection closed. Retrying in 5 seconds...', isError: true });
        const timer = setTimeout(connectWebSocket, 5000);
        setReconnectTimer(timer);
      }
    };

    setWs(wsConnection);
  }, [updateEntityState, settings.autoReconnect]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
    };
  }, [connectWebSocket]);

  const toggleEntity = (entityId) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const domain = entityId.split(".")[0];
      ws.send(JSON.stringify({
        id: Math.floor(Math.random() * 1000) + 1,
        type: "call_service",
        domain: domain,
        service: "toggle",
        target: {
          entity_id: entityId
        }
      }));
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      localStorage.setItem('dashboardSettings', JSON.stringify(newSettings));
      return newSettings;
    });
  };

  const renderEntityCard = (domain, entityData) => {
    if (settings.displayMode === 'compact') {
      return (
        <div key={entityData.entity_id} className="p-2 border rounded">
          <div className="flex justify-between items-center">
            <span>{entityData.attributes.friendly_name || entityData.entity_id}</span>
            {['light', 'switch', 'automation'].includes(domain) && (
              <Button
                onClick={() => toggleEntity(entityData.entity_id)}
                variant={entityData.state === 'on' ? 'default' : 'secondary'}
                size="sm"
              >
                {entityData.state === 'on' ? 'On' : 'Off'}
              </Button>
            )}
          </div>
          {aiEnabled && (
            <div className="mt-2">
              <h4 className="text-sm font-medium mb-2">AI Suggestions</h4>
              <ul className="list-disc pl-4 text-sm space-y-1">
                <li className="text-gray-600">Optimize {domain} settings</li>
                <li className="text-gray-600">Monitor {domain} usage patterns</li>
              </ul>
            </div>
          )}
        </div>
      );
    }
  
    if (settings.displayMode === 'list') {
      return (
        <div key={entityData.entity_id} className="p-4 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">{entityData.attributes.friendly_name || entityData.entity_id}</h3>
              <p className="text-sm text-gray-600">{entityData.entity_id}</p>
              <p>Status: <span className="font-bold">{entityData.state}</span></p>
              {aiEnabled && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium mb-2">AI Suggestions</h4>
                  <ul className="list-disc pl-4 text-sm space-y-1">
                    <li className="text-gray-600">Optimize {domain} settings</li>
                    <li className="text-gray-600">Monitor {domain} usage patterns</li>
                  </ul>
                </div>
              )}
            </div>
            {['light', 'switch', 'automation'].includes(domain) && (
              <Button
                onClick={() => toggleEntity(entityData.entity_id)}
                variant={entityData.state === 'on' ? 'default' : 'secondary'}
                size="sm"
              >
                {entityData.state === 'on' ? 'On' : 'Off'}
              </Button>
            )}
          </div>
        </div>
      );
    }
  
    // Default card view
    return (
      <Card key={entityData.entity_id} className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-medium">
            {entityData.attributes.friendly_name || entityData.entity_id}
          </CardTitle>
          {['light', 'switch', 'automation'].includes(domain) && (
            <Button
              onClick={() => toggleEntity(entityData.entity_id)}
              variant={entityData.state === 'on' ? 'default' : 'secondary'}
              size="sm"
            >
              {entityData.state === 'on' ? 'On' : 'Off'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600">{entityData.entity_id}</div>
          <div className="mt-2">Status: <span className="font-bold">{entityData.state}</span></div>
          {aiEnabled && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">AI Suggestions</h4>
              <ul className="list-disc pl-4 text-sm space-y-1">
                <li className="text-gray-600">Optimize {domain} settings</li>
                <li className="text-gray-600">Monitor {domain} usage patterns</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      {/* Status message */}
      <div className={`mb-4 p-4 rounded-lg ${status.isError ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
        {status.message}
      </div>

      <Tabs defaultValue="entities">
        <TabsList className="mb-4">
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Entities</h2>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <Switch
                checked={aiEnabled}
                onCheckedChange={setAiEnabled}
                className="ml-2"
              />
              <span className="text-sm">AI Suggestions</span>
            </div>
          </div>

          {Object.entries(entities).sort().map(([domain, domainEntities]) => (
            <div key={domain} className="mb-8">
              <h3 className="text-xl font-semibold text-blue-500 mb-4">
                {domain.charAt(0).toUpperCase() + domain.slice(1)} ({Object.keys(domainEntities).length})
              </h3>
              <div className={`grid gap-4 ${
                settings.displayMode === 'compact' ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4' :
                settings.displayMode === 'list' ? 'grid-cols-1' :
                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              }`}>
                {Object.values(domainEntities)
                  .sort((a, b) => a.entity_id.localeCompare(b.entity_id))
                  .map(entity => renderEntityCard(domain, entity))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="dashboard">
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Historical Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <LineChart
                    width={800}
                    height={300}
                    data={historicalData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="activeEntities" stroke="#8884d8" name="Active Entities" />
                  </LineChart>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Suggestions Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] w-full">
                  <BarChart
                    width={800}
                    height={300}
                    data={historicalData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="suggestions" fill="#82ca9d" name="AI Suggestions" />
                  </BarChart>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-6 w-6" />
                Dashboard Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="refreshInterval">Refresh Interval (seconds)</Label>
                  <Input
                    id="refreshInterval"
                    type="number"
                    value={settings.refreshInterval}
                    onChange={(e) => handleSettingChange('refreshInterval', e.target.value)}
                    className="max-w-xs"
                    min="5"
                    max="300"
                  />
                  <span className="text-xs text-gray-500">Range: 5-300 seconds</span>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                        <Select
                        id="theme"
                        value={settings.theme}
                        onValueChange={(value) => handleSettingChange('theme', value)}
                        className={`max-w-xs ${settings.theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="system">System</option>
                       </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayMode">Display Mode</Label>
                  <Select
  id="displayMode"
  value={settings.displayMode}
  onValueChange={(value) => handleSettingChange('displayMode', value)}
  className={`max-w-xs ${settings.theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
>
  <option value="card">Card View</option>
  <option value="list">List View</option>
  <option value="compact">Compact View</option>
</Select>

                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="notifications"
                    checked={settings.notificationsEnabled}
                    onCheckedChange={(checked) => handleSettingChange('notificationsEnabled', checked)}
                  />
                  <Label htmlFor="notifications">Enable Notifications</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="autoReconnect"
                    checked={settings.autoReconnect}
                    onCheckedChange={(checked) => handleSettingChange('autoReconnect', checked)}
                  />
                  <Label htmlFor="autoReconnect">Auto Reconnect</Label>
                </div>
              </div>

              <div className="pt-4">
                <Button 
                  onClick={() => {
                    handleSettingChange('theme', settings.theme);
                    handleSettingChange('displayMode', settings.displayMode);
                    handleSettingChange('refreshInterval', settings.refreshInterval);
                    handleSettingChange('notificationsEnabled', settings.notificationsEnabled);
                    handleSettingChange('autoReconnect', settings.autoReconnect);
                    showNotification('Settings Saved', 'Your dashboard settings have been updated.');
                  }}
                  className="mr-2"
                >
                  Save Settings
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSettings({
                      refreshInterval: "30",
                      theme: "light",
                      displayMode: "card",
                      notificationsEnabled: true,
                      autoReconnect: true
                    });
                  }}
                >
                  Reset to Defaults
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EntityDashboard;
