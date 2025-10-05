<script>
    import {onMount} from 'svelte';
    import {spektrixService} from './services/spektrix.js';
    import EventCard from './components/EventCard.svelte';
    import {RefreshCw} from 'lucide-svelte';
    import {Toaster} from '@skeletonlabs/skeleton-svelte';
    import {toaster} from './toaster.js';

    // Parse event IDs from URL query parameters
    function getEventIdsFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const eventIdsParam = urlParams.get('eventIds');

        if (!eventIdsParam) {
            // Return null to indicate no event IDs provided
            return null;
        }

        // Split by comma and trim whitespace
        return eventIdsParam.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }

    const SPEKTRIX_EVENT_IDS = getEventIdsFromUrl();
    const WEBSITE_BASE_URL = 'https://musicacademy.org';

    let events = $state([]);
    let availability = $state({});
    let selectedTickets = $state([]);
    let attendees = $state([]);
    let basketItems = $state({
        tickets: [],
        total: 0
    });
    let basketLoading = $state(true); // Add separate loading state for basket
    let loading = $state(true);
    let error = $state(null);

    // Enhanced user presence detection
    let isUserPresent = $state(true);
    let lastUserActivity = $state(Date.now());
    let availabilityInterval;

    // Configuration for user presence detection
    const ACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes of inactivity = user not present
    const REFRESH_INTERVAL = 30 * 1000; // 30 seconds between availability checks
    const PRESENCE_CHECK_INTERVAL = 30 * 1000; // Check user presence every 30 seconds

    onMount(() => {
        // Only load data if we have event IDs
        if (SPEKTRIX_EVENT_IDS) {
            loadInitialData();
            setupUserPresenceDetection();
            setupIFrameHeightResizing();
        } else {
            // No event IDs provided, set loading to false to show error state
            loading = false;
            setupIFrameHeightResizing(); // Still setup height resizing for error state
        }
    });

    /**
     * Enhanced user presence detection that works in iFrames and detects laptop lid closures
     * Combines multiple detection methods for better accuracy
     */
    function setupUserPresenceDetection() {
        let presenceCheckInterval;

        // Track user activity through multiple events
        const updateUserActivity = () => {
            lastUserActivity = Date.now();
            if (!isUserPresent) {
                isUserPresent = true;
                startRefreshInterval();
            }
        };

        // Activity events to track (works in iFrames)
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click',
            'focus',
            'blur'
        ];

        // Add event listeners for user activity
        activityEvents.forEach(event => {
            document.addEventListener(event, updateUserActivity, {passive: true});
        });

        // Check for window/page visibility changes (primary detection)
        const handleVisibilityChange = () => {
            if (document.hidden) {
                isUserPresent = false;
                stopRefreshInterval();
            } else {
                updateUserActivity();
                refreshAvailability(); // Immediate refresh when page becomes visible
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // For iFrame environments, also listen to window focus/blur
        const handleWindowFocus = () => {
            updateUserActivity();
            refreshAvailability();
        };

        window.addEventListener('focus', handleWindowFocus);

        // Periodic presence check (detects laptop lid closure, long inactivity)
        const checkUserPresence = () => {
            const timeSinceActivity = Date.now() - lastUserActivity;
            const shouldBePresent = !document.hidden && timeSinceActivity < ACTIVITY_TIMEOUT;

            if (shouldBePresent !== isUserPresent) {
                isUserPresent = shouldBePresent;

                if (isUserPresent) {
                    startRefreshInterval();
                    refreshAvailability(); // Immediate refresh when user returns
                } else {
                    stopRefreshInterval();
                }
            }
        };

        // Start presence monitoring
        presenceCheckInterval = setInterval(checkUserPresence, PRESENCE_CHECK_INTERVAL);

        // Start availability refresh if user is initially present
        if (isUserPresent && !document.hidden) {
            startRefreshInterval();
        }

        // Cleanup function for onMount
        return () => {
            activityEvents.forEach(event => {
                document.removeEventListener(event, updateUserActivity);
            });
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);

            if (presenceCheckInterval) {
                clearInterval(presenceCheckInterval);
            }
            stopRefreshInterval();
        };
    }

    function startRefreshInterval() {
        stopRefreshInterval();

        if (isUserPresent && !document.hidden) {
            availabilityInterval = setInterval(() => {
                // Double-check user presence before each refresh
                if (isUserPresent && !document.hidden) {
                    refreshAvailability();
                }
            }, REFRESH_INTERVAL);
        }
    }

    function stopRefreshInterval() {
        if (availabilityInterval) {
            clearInterval(availabilityInterval);
            availabilityInterval = null;
        }
    }

    async function loadInitialData() {
        loading = true;
        error = null;

        try {
            // Load events first, then availability (which depends on events)
            await loadEvents();
            await Promise.all([
                loadAvailability(),
                loadBasket()
            ]);// Load events first, then availability (which depends on events)
        } catch (err) {
            error = err.message;
            console.error('Error loading initial data:', err);
        } finally {
            loading = false;
        }
    }

    async function loadEvents() {
        const eventPromises = SPEKTRIX_EVENT_IDS.map(id =>
            spektrixService.getEventDetails(id)
        );
        events = await Promise.all(eventPromises);
    }

    async function loadAvailability() {
        const availabilityPromises = events.map(async (event) => {
            try {
                // Use the instance that's already attached to the event
                const instance = event.instance;

                if (instance) {
                    // Get comprehensive availability data including individual area status
                    const availabilityInfo = await spektrixService.getInstanceAvailabilityData(instance.id);

                    return {
                        eventId: event.id,
                        data: {
                            instance,
                            ...availabilityInfo
                        }
                    };
                } else {
                    console.error(`No instance found for event ${event.id}`);
                }
                return {
                    eventId: event.id,
                    data: null
                };
            } catch (err) {
                console.error(`Error loading availability data for event ${event.id}:`, err);
                return {
                    eventId: event.id,
                    data: null
                };
            }
        });

        const results = await Promise.all(availabilityPromises);

        const availabilityData = {};
        results.forEach(({
                             eventId,
                             data
                         }) => {
            if (data) {
                availabilityData[eventId] = data;
            }
        });

        availability = availabilityData;
    }

    async function refreshAvailability() {
        try {
            const previousAvailability = {...availability};

            await loadEvents();

            await Promise.all([
                loadAvailability(),
                loadBasket()
            ]);

            // Only validate selected tickets if there are pending selections (not yet in basket)
            if (selectedTickets.length > 0) {
                validateSelectedTicketsAvailability(previousAvailability);
            }
        } catch (err) {
            console.error('Error refreshing availability and basket:', err);
        }
    }

    function validateSelectedTicketsAvailability(previousAvailability) {
        const unavailableSelections = [];
        const updatedSelections = [];

        selectedTickets.forEach(selection => {
            const eventAvailability = availability[selection.eventId];
            if (!eventAvailability) return;

            // Get current availability for this area
            const areaStatus = eventAvailability.areaStatuses?.[selection.areaId];
            const currentAvailable = areaStatus?.available || 0;

            if (currentAvailable === 0) {
                // Area is completely sold out
                unavailableSelections.push({
                    ...selection,
                    reason: 'sold_out',
                    areaName: selection.areaName
                });
            } else if (currentAvailable < selection.quantity) {
                // Not enough tickets available, reduce quantity to what's available
                const previousAvailable = previousAvailability[selection.eventId]?.areaStatuses?.[selection.areaId]?.available || 0;

                // Only show notification if availability actually decreased during this refresh
                if (currentAvailable < previousAvailable) {
                    unavailableSelections.push({
                        ...selection,
                        reason: 'quantity_reduced',
                        originalQuantity: selection.quantity,
                        newQuantity: currentAvailable,
                        areaName: selection.areaName
                    });
                }

                // Update the selection to the maximum available
                updatedSelections.push({
                    ...selection,
                    quantity: currentAvailable
                });
            } else {
                // Still available, keep as is
                updatedSelections.push(selection);
            }
        });

        // Update selected tickets if any changes needed
        if (updatedSelections.length !== selectedTickets.length ||
            updatedSelections.some((sel, i) => sel.quantity !== selectedTickets[i]?.quantity)) {
            selectedTickets = updatedSelections;
            updateAttendeesList();
        }

        // Show notifications for unavailable tickets
        if (unavailableSelections.length > 0) {
            showAvailabilityNotifications(unavailableSelections);
        }
    }

    function showAvailabilityNotifications(unavailableSelections) {
        unavailableSelections.forEach(selection => {
            if (selection.reason === 'sold_out') {
                // Show error toast for sold out tickets
                toaster.error({
                    title: 'Tickets No Longer Available',
                    description: `${selection.areaName} tickets for ${selection.eventName} are no longer available. They may have been purchased by another customer.`
                });
            } else if (selection.reason === 'quantity_reduced') {
                // Show warning toast for quantity reductions
                toaster.warning({
                    title: 'Availability Updated',
                    description: `Only ${selection.newQuantity} ${selection.areaName} tickets are now available for ${selection.eventName} (you had selected ${selection.originalQuantity}). Your selection has been automatically adjusted.`
                });
            }
        });
    }

    async function loadBasket() {
        try {
            basketItems = await spektrixService.getBasketContents();
        } catch (err) {
            console.error('Error loading basket:', err);
            basketItems = {
                tickets: [],
                total: 0
            };
        } finally {
            basketLoading = false;
        }
    }

    function handleTicketSelection(selection = {}) {
        // Remove existing selection for this event/ticket type/area combination
        selectedTickets = selectedTickets.filter(t =>
            !(t.eventId === selection.eventId &&
                t.ticketTypeId === selection.ticketTypeId &&
                t.areaId === selection.areaId)
        );

        // Add new selection if quantity > 0
        if (selection.quantity > 0) {
            selectedTickets = [
                ...selectedTickets,
                selection];
        }

        updateAttendeesList();
    }

    function updateAttendeesList() {
        const newAttendees = [];

        // Get all events that have selected tickets to maintain consistent ordering
        const eventsWithTickets = [...new Set(selectedTickets.map(t => t.eventId))];

        eventsWithTickets.forEach(eventId => {
            // Get the event's availability data to determine area ordering
            const eventAvailability = availability[eventId];
            if (!eventAvailability?.plan?.areas) return;

            // Sort attendees by the same order as areas appear in the UI
            eventAvailability.plan.areas.forEach(area => {
                // Find all selected tickets for this event and area, sorted by price band
                const areaTickets = selectedTickets
                    .filter(ticket =>
                        ticket.eventId === eventId &&
                        ticket.areaId === area.id
                    )
                    .sort((a, b) => {
                        // Sort by price band (A before B)
                        if (a.priceBandId !== b.priceBandId) {
                            return a.priceBandId.localeCompare(b.priceBandId);
                        }
                        // Then by ticket type ID for consistency
                        return a.ticketTypeId.localeCompare(b.ticketTypeId);
                    });

                // Create attendees for each ticket in the correct order
                areaTickets.forEach(ticket => {
                    for (let i = 0; i < ticket.quantity; i++) {
                        // Try to find existing attendee data
                        const existing = attendees.find(a =>
                            a.eventId === ticket.eventId &&
                            a.ticketTypeId === ticket.ticketTypeId &&
                            a.areaId === ticket.areaId &&
                            a.ticketIndex === i
                        );

                        newAttendees.push({
                            id: `${ticket.eventId}-${ticket.ticketTypeId}-${ticket.areaId}-${i}`,
                            eventId: ticket.eventId,
                            eventName: ticket.eventName,
                            ticketTypeId: ticket.ticketTypeId,
                            areaId: ticket.areaId,
                            ticketIndex: i,
                            ticketInfo: ticket.areaName,
                            price: ticket.price,
                            firstName: existing?.firstName || '',
                            lastName: existing?.lastName || '',
                            mealChoice: existing?.mealChoice || '',
                            dietaryRestrictions: existing?.dietaryRestrictions || ''
                        });
                    }
                });
            });
        });

        attendees = newAttendees;
    }

    function handleAttendeeUpdate(updateData) {
        const {
            index,
            attendee: updatedAttendee
        } = updateData;

        if (attendees[index]) {
            attendees[index] = {...attendees[index], ...updatedAttendee};
            attendees = [...attendees]; // Trigger reactivity
        }
    }

    async function addTicketsToBasket() {
        if (!validateAllAttendees()) {
            toaster.warning({
                title: 'Incomplete Information',
                description: 'Please fill in all required attendee information (name and meal choice) before adding to basket.'
            });
            return;
        }

        loading = true;
        error = null;

        try {
            // Get current basket contents to identify existing ticket IDs
            const currentBasket = await spektrixService.getBasketContents();
            const existingTicketIds = new Set(currentBasket.tickets?.map(t => t.id) || []);

            // Build tickets array in the format Spektrix expects
            const ticketsToAdd = [];

            selectedTickets.forEach(ticket => {
                for (let i = 0; i < ticket.quantity; i++) {
                    ticketsToAdd.push({
                        instanceId: ticket.instanceId,
                        ticketTypeId: ticket.ticketTypeId,
                        planId: ticket.planId || ticket.areaId
                    });
                }
            });

            // Add all tickets to basket in one call
            const basketResponse = await spektrixService.addTicketsToBasket(ticketsToAdd);

            // Update ticket attributes for each ticket BEFORE reloading the basket
            if (Array.isArray(basketResponse) && basketResponse.length > 0) {

                // Filter to get only the newly added tickets (those not in existingTicketIds)
                const newlyAddedTickets = basketResponse.filter(ticket => !existingTicketIds.has(ticket.id));

                // Now map the newly added tickets to attendees in order
                for (let i = 0; i < newlyAddedTickets.length && i < attendees.length; i++) {
                    const ticket = newlyAddedTickets[i];
                    const attendee = attendees[i];

                    if (ticket && attendee) {
                        // Trim names and dietary restrictions before adding to basket
                        const trimmedFirstName = attendee.firstName.trim();
                        const trimmedLastName = attendee.lastName.trim();
                        const trimmedDietaryRestrictions = attendee.dietaryRestrictions?.trim() || '';

                        const attributes = {
                            'attribute_Registrant Name': `${trimmedFirstName} ${trimmedLastName}`,
                            'attribute_Registrant Meal Choice': attendee.mealChoice,
                            ...(trimmedDietaryRestrictions && {'attribute_Registrant Dietary Restrictions': trimmedDietaryRestrictions})
                        };

                        try {
                            await spektrixService.updateTicketAttributes(ticket.id, attributes);
                        } catch (updateError) {
                            console.error(`[App] Failed to update ticket ${ticket.id}:`, updateError);
                        }
                    } else {
                        console.warn(`[App] Missing ticket or attendee data at index ${i}:`, {
                            ticket: !!ticket,
                            attendee: !!attendee
                        });
                    }
                }
            } else {
                console.warn('No tickets in basket response:', basketResponse);
            }

            // Clear selections and reload basket AFTER attributes are updated
            selectedTickets = [];
            attendees = [];
            await loadBasket();

            // Refresh availability after adding to basket to ensure current data
            await refreshAvailability();

        } catch (err) {
            error = err.message;
            console.error('Error adding tickets to basket:', err);
        } finally {
            loading = false;
        }
    }

    function validateAllAttendees() {
        return attendees.every(attendee =>
            attendee.firstName.trim() &&
            attendee.lastName.trim() &&
            attendee.mealChoice
        );
    }

    async function handleBasketUpdated() {
        await loadBasket();
        // Refresh availability after basket changes to ensure current data
        await refreshAvailability();
    }

    function handleProceedToCheckout() {
        // Use direct navigation - works with sandbox="allow-top-navigation"
        window.top.location.href = `${WEBSITE_BASE_URL}/checkout`;
    }

    function handleGetMariposaTickets() {
        // Use direct navigation - works with sandbox="allow-top-navigation"
        window.top.location.href = `${WEBSITE_BASE_URL}/mariposa`;
    }

    function handleGetMoreAdvancementTickets() {
        // Use direct navigation - works with sandbox="allow-top-navigation"
        window.top.location.href = `${WEBSITE_BASE_URL}/upclose`;
    }

    function handleAddEventToBasket() {
        addTicketsToBasket();
    }

    /**
     * Setup automatic iFrame height resizing for parent window
     */
    function setupIFrameHeightResizing() {
        // Only run if we're in an iFrame
        if (window.self === window.top) return;

        let lastHeight = 0;

        // Create unique identifier for this iFrame instance based on event IDs
        const iframeId = SPEKTRIX_EVENT_IDS ? SPEKTRIX_EVENT_IDS.join('-') : 'default';

        const sendHeightToParent = () => {
            // Get the full document height
            const currentHeight = document.documentElement.scrollHeight;

            // Add 20px padding to prevent content cutoff
            const heightWithPadding = currentHeight + 20;

            // Only send if height has changed significantly (avoid spam)
            if (Math.abs(heightWithPadding - lastHeight) > 10) {
                lastHeight = heightWithPadding;

                // Send height to parent window with unique identifier
                window.parent.postMessage({
                    type: 'iframe-height-update',
                    height: heightWithPadding,
                    source: 'advancement-tickets',
                    iframeId: iframeId,
                    eventIds: SPEKTRIX_EVENT_IDS
                }, 'https://musicacademy.org');
            }
        };

        // Send initial height
        setTimeout(sendHeightToParent, 100);

        // Monitor for height changes using ResizeObserver (modern browsers)
        if (window.ResizeObserver) {
            const resizeObserver = new ResizeObserver(() => {
                sendHeightToParent();
            });

            resizeObserver.observe(document.body);

            // Cleanup function
            return () => {
                resizeObserver.disconnect();
            };
        } else {
            // Fallback for older browsers - poll for height changes
            const heightCheckInterval = setInterval(sendHeightToParent, 500);

            return () => {
                clearInterval(heightCheckInterval);
            };
        }
    }
</script>

<div class="container mx-auto p-4 flex flex-col gap-6 max-w-7xl">

    {#if !SPEKTRIX_EVENT_IDS}
        <!-- Error state when no eventIds parameter provided -->
        <div class="flex items-center justify-center py-24">
            <div class="text-center space-y-4 max-w-md">
                <div class="card py-6 px-6 preset-filled-error-100-900 border border-error-300-700">
                    <h2 class="h3 mb-3">No Events Specified</h2>
                    <p class="text-sm mb-4 leading-tight">
                        Specify event IDs in the URL query parameters using the <code>eventIds</code> parameter.
                    </p>
                    <div class="text-xs text-left bg-surface-900-50 p-3 rounded border font-mono">
                        <strong>Example:</strong><br>
                        ?eventIds=EVENT_ID_1<br>
                        ?eventIds=EVENT_ID_1,EVENT_ID_2
                    </div>
                </div>
            </div>
        </div>
    {:else if loading && events.length === 0}
        <!-- Large centered loading spinner -->
        <div class="flex items-center justify-center py-24">
            <div class="text-center space-y-4">
                <div class="animate-spin rounded-full h-16 w-16 border-4 border-primary-500 border-t-transparent mx-auto"></div>
                <p class="text-surface-600 dark:text-surface-400 text-lg">Loading events...</p>
            </div>
        </div>
    {:else if error}
        <div class="card py-3 px-4 preset-filled-warning-100-900 border border-warning-300-700">
            <span>Error: {error}</span>
            <button class="btn preset-filled-warning-500" onclick={loadInitialData}>
                <RefreshCw size={16}/>
                <span>Retry</span>
            </button>
        </div>
    {:else}
        <!-- Single column layout with individual event basket summaries -->
        <div class="max-w-4xl mx-auto flex flex-col gap-6 py-4 lg:py-8">
            <!-- Event cards with integrated basket summaries -->
            {#each events as event}
                <EventCard
                        {event}
                        availability={availability[event.id]}
                        {selectedTickets}
                        {attendees}
                        {basketItems}
                        {basketLoading}
                        {loading}
                        numTicketsInBasket={basketItems.tickets?.filter(t => t.event?.id === event.id).length || 0}
                        onticketselection={handleTicketSelection}
                        onattendeeupdate={handleAttendeeUpdate}
                        onaddtobasket={handleAddEventToBasket}
                        onbasketupdated={handleBasketUpdated}
                        onproceedtocheckout={handleProceedToCheckout}
                        ongetmariposatickets={handleGetMariposaTickets}
                        ongetmoreadvancementtickets={handleGetMoreAdvancementTickets}
                        websiteBaseUrl={WEBSITE_BASE_URL}
                />
            {/each}
        </div>
    {/if}

    <!-- Toaster component for notifications -->
    <Toaster {toaster}/>
</div>
