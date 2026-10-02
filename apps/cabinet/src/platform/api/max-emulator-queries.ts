import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './api-context';

/** The emulator is a live chat: the list refreshes slowly, an open chat quickly. */
const CHATS_REFRESH_MS = 5_000;
const CHAT_REFRESH_MS = 1_500;

const keys = {
  chats: (businessId: string) => ['max-chats', businessId] as const,
  chat: (businessId: string, userId: string) => ['max-chat', businessId, userId] as const,
};

export function useMaxChats(businessId: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.chats(businessId),
    queryFn: ({ signal }) =>
      api.request('listMaxEmulatorChats', { params: { businessId } }, { signal }),
    refetchInterval: CHATS_REFRESH_MS,
  });
}

export function useMaxChat(businessId: string, userId: string | null) {
  const api = useApi();
  return useQuery({
    queryKey: keys.chat(businessId, userId ?? ''),
    queryFn: ({ signal }) =>
      api.request(
        'getMaxEmulatorChat',
        { params: { businessId, userId: userId ?? '' } },
        { signal },
      ),
    enabled: userId !== null,
    refetchInterval: CHAT_REFRESH_MS,
  });
}

/** Actions of the client in the emulated MAX app; the bot's answer arrives with polling. */
export function useMaxChatActions(businessId: string, userId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: keys.chat(businessId, userId) });
    void queryClient.invalidateQueries({ queryKey: keys.chats(businessId) });
  };
  const params = { businessId, userId };
  return {
    start: useMutation({
      mutationFn: () => api.request('startMaxEmulatorChat', { params }),
      onSuccess: refresh,
    }),
    send: useMutation({
      mutationFn: (text: string) => api.request('sendMaxEmulatorText', { params, body: { text } }),
      onSuccess: refresh,
    }),
    press: useMutation({
      mutationFn: (input: { messageId: string; payload: string }) =>
        api.request('pressMaxEmulatorButton', { params, body: input }),
      onSuccess: refresh,
    }),
  };
}
