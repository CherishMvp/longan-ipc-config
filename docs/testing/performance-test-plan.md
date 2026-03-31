# WVP Integration Performance Test Plan

## Test Scenarios

### 1. 9-Stream Concurrent Playback
- Layout: 3x3 grid
- Expected: CPU < 40%, Memory < 1.5GB
- Pass Criteria: All streams play without black screen for 30 minutes

### 2. 16-Stream Concurrent Playback
- Layout: 4x4 grid
- Expected: CPU < 60%, Memory < 2.5GB
- Pass Criteria: All streams play without black screen for 30 minutes

### 3. Network Jitter Simulation
- Tool: Chrome DevTools Network Throttling
- Scenario: Simulate 3G network for 1 minute
- Pass Criteria: Auto-reconnect within 5 seconds

### 4. Long-Running Stability Test
- Duration: 2 hours
- Pass Criteria: No memory leaks, no black screens

## Test Commands

```bash
# Run 9-stream test
node scripts/test-concurrent-streams.js 9

# Run 16-stream test
node scripts/test-concurrent-streams.js 16
```

## Manual Testing Checklist

- [ ] Login to WVP and get device list
- [ ] Start 9-stream video wall
- [ ] Verify all streams show green signal indicator
- [ ] Wait 30 minutes, verify no black screens
- [ ] Simulate network disconnect (unplug cable)
- [ ] Verify auto-reconnect within 5 seconds
- [ ] Test on Win7 machine for compatibility
