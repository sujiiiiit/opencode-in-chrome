import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tooltip } from '@/components/ui/tooltip';
import { useBrowserActivity } from './use-browser-activity';

const SHARE = 'Share this tab with the chat';

/**
 * The composer's browser controls, shown while browser access is on: share the tab in front
 * of you with the chat, and stop (or resume) everything the agent does in the browser.
 */
export const BrowserControls = memo(function BrowserControls({ sessionID }: { sessionID: string | undefined }) {
  const { activity, error, shareActiveTab, stop, resume } = useBrowserActivity(sessionID);
  if (!activity.enabled) return null;
  const count = activity.tabIds.length;
  return (
    <div className="flex items-center gap-0.5" data-slot="browser-controls">
      <Tooltip label={error ?? (count ? `${SHARE} (${count} tab${count === 1 ? '' : 's'} in use)` : SHARE)}>
        <Button variant="ghost" size="icon-sm" aria-label={SHARE} disabled={!sessionID} onClick={() => void shareActiveTab()}>
          <Icon name="browser" />
        </Button>
      </Tooltip>
      {activity.stopped ? (
        <Button variant="ghost" size="sm" className="font-normal text-text-secondary" onClick={() => void resume()}>
          Resume browser
        </Button>
      ) : (
        count > 0 && (
          <Tooltip label="Stop all browser activity">
            <Button variant="ghost" size="icon-sm" aria-label="Stop browser activity" onClick={() => void stop()}>
              <Icon name="stop" />
            </Button>
          </Tooltip>
        )
      )}
      {error && (
        <span role="alert" className="sr-only">
          {error}
        </span>
      )}
    </div>
  );
});
