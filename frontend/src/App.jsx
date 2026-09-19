import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import JoinRoomForm from './components/JoinRoomForm';
import { useTheme } from './hooks/useTheme';
import socket from './socket';
import config from './config';

const Canvas = lazy(() => import('./Canvas'));

function App() {
  const { isDark } = useTheme();
  const [isConnected, setIsConnected] = useState(false);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomJustCreated, setRoomJustCreated] = useState(false);
  const [roomData, setRoomData] = useState(null);

  // Refs to always hold latest values inside socket callbacks without re-registering
  const userIdRef = useRef(userId);
  const adminKeyRef = useRef(adminKey);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { adminKeyRef.current = adminKey; }, [adminKey]);

  // Restore session fields from localStorage on mount (pre-fill form only)
  useEffect(() => {
    const savedSession = localStorage.getItem('scribble-session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.roomId && session.userId) {
          console.info('Pre-filling form from saved session:', session);
          setRoomId(session.roomId);
          setUserId(session.userId);
          setAdminKey(session.adminKey || '');
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        localStorage.removeItem('scribble-session');
      }
    }
  }, []);

  useEffect(() => {
    socket.connect();

    const handleConnect = () => {
      setIsConnected(true);
      setError('');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err) => {
      setError(`Connection failed: ${err.message}`);
    };

    const handleJoinAck = ({ roomId: joinedRoomId, isAdmin }) => {
      console.info('App: Join ACK received, isAdmin:', isAdmin);
      setRoomData({ roomId: joinedRoomId, isAdmin });
      setHasJoinedRoom(true);
      setError('');

      // Use refs so we always capture the latest values without re-registering
      const session = {
        roomId: joinedRoomId,
        userId: userIdRef.current,
        adminKey: adminKeyRef.current || undefined
      };
      localStorage.setItem('scribble-session', JSON.stringify(session));
      console.info('Session saved to localStorage');
    };

    const handleRoomJoined = (data) => {
      console.info('App: Room joined full data:', data);
      setRoomData(data);
    };

    const handleError = ({ message }) => {
      setError(message);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('join-ack', handleJoinAck);
    socket.on('room-joined', handleRoomJoined);
    socket.on('error', handleError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('join-ack', handleJoinAck);
      socket.off('room-joined', handleRoomJoined);
      socket.off('error', handleError);
    };
  }, []);

  const handleJoinRoom = useCallback((e) => {
    e.preventDefault();
    setError('');
    
    if (!roomId.trim() || !userId.trim()) {
      setError('Room ID and User Name are required');
      return;
    }

    const joinData = {
      roomId: roomId.trim(),
      userId: userId.trim(),
    };

    if (adminKey.trim()) {
      joinData.adminKey = adminKey.trim();
      console.info('Joining as ADMIN with adminKey:', adminKey.trim());
    } else {
      console.info('Joining as STUDENT (no admin key)');
    }

    console.info('Emitting joinRoom with data:', joinData);
    socket.emit('joinRoom', joinData);
    
  }, [roomId, userId, adminKey]);

  const createTestRoom = useCallback(async () => {
    setError('');
  // Reset any previously created room before creating a new one
    setRoomId('');
    setAdminKey('');
    setRoomJustCreated(false);
    setIsCreatingRoom(true);

    try {
      const response = await fetch(`${config.server.url}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        let serverMsg = 'Failed to create room';
        try {
          const errBody = await response.json();
          if (errBody?.message) serverMsg = errBody.message;
        } catch { /* ignore parse errors */ }
        throw new Error(serverMsg);
      }

      const data = await response.json();

      if (data.roomId && data.adminKey) {
        setRoomId(data.roomId);
        setAdminKey(data.adminKey);
        setRoomJustCreated(true);
        setError('');
        console.info('Room created successfully:', {
          roomId: data.roomId,
          adminKey: data.adminKey
        });
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsCreatingRoom(false);
    }
  }, []);

  const handleLeaveRoom = useCallback(() => {
    socket.emit('leaveRoom');
    // Disconnect and reconnect so the socket gets a clean state for next join
    socket.disconnect();
    socket.connect();
    setHasJoinedRoom(false);
    setRoomId('');
    setAdminKey('');
    setUserId('');
    setRoomData(null);
    setRoomJustCreated(false);

    // Clear session from localStorage
    localStorage.removeItem('scribble-session');
    console.info('Session cleared from localStorage');
  }, []);

  if (!hasJoinedRoom) {
    return (
      <ErrorBoundary>
        <div className={`min-h-screen flex items-center justify-center p-4 ${
          isDark ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50'
        }`}>
          <JoinRoomForm
            isConnected={isConnected}
            error={error}
            roomId={roomId}
            setRoomId={setRoomId}
            adminKey={adminKey}
            setAdminKey={setAdminKey}
            userId={userId}
            setUserId={setUserId}
            handleJoinRoom={handleJoinRoom}
            createTestRoom={createTestRoom}
            isCreatingRoom={isCreatingRoom}
            roomJustCreated={roomJustCreated}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner /></div>}>
        <Canvas onLeaveRoom={handleLeaveRoom} initialRoomData={roomData} />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
