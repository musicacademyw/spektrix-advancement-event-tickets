<script>
    import {onMount} from 'svelte';
    import {spektrixService} from './services/spektrix.js';
    import EventCard from './components/EventCard.svelte';
    import BasketSummary from './components/BasketSummary.svelte';
    import {RefreshCw} from 'lucide-svelte';
    import {Toaster} from '@skeletonlabs/skeleton-svelte';
    import {toaster} from './toaster.js';

    const SPEKTRIX_EVENT_IDS = [
        '101001ASRCJQGCSBLJCPNPQQRRGSLJCLH',
        '101201AKQDJBPLLQCKLJCTLCMQDHDTGBQ'
    ];

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
    let isTabVisible = $state(true);

    // Auto-refresh availability every 30 seconds
    let availabilityInterval;

    onMount(() => {
        loadInitialData();

        // Set up tab visibility detection
        const handleVisibilityChange = () => {
            isTabVisible = !document.hidden;

            if (isTabVisible) {
                // Tab became visible - refresh data and restart interval
                refreshAvailability();
                startAvailabilityInterval();
            } else {
                // Tab became hidden - stop interval
                stopAvailabilityInterval();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Start periodic availability refresh only if tab is visible
        if (isTabVisible) {
            startAvailabilityInterval();
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            stopAvailabilityInterval();
        };
    });

    function startAvailabilityInterval() {
        // Clear any existing interval first
        stopAvailabilityInterval();

        // Only start if tab is visible
        if (isTabVisible) {
            availabilityInterval = setInterval(() => {
                if (isTabVisible) {
                    refreshAvailability();
                }
            }, 30000);
        }
    }

    function stopAvailabilityInterval() {
        if (availabilityInterval) {
            clearInterval(availabilityInterval);
            availabilityInterval = null;
        }
    }

    async function loadInitialData() {
        loading = true;
        error = null;

        try {
            // Load event details and availability (no client init needed)
            await Promise.all([
                loadEvents(),
                loadAvailability(),
                loadBasket()
            ]);
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
        const availabilityPromises = SPEKTRIX_EVENT_IDS.map(async (eventId) => {
            try {
                // Get instances for this event (no date filtering since each event has a single instance)
                const instances = await spektrixService.getEventInstances(eventId);

                if (instances.length > 0) {
                    // Get comprehensive availability data including individual area status
                    const instance = instances[0];
                    const availabilityInfo = await spektrixService.getInstanceAvailabilityData(instance.id);

                    return {
                        eventId,
                        data: {
                            instance,
                            ...availabilityInfo
                        }
                    };
                }
                return {
                    eventId,
                    data: null
                };
            } catch (err) {
                console.error(`Error loading data for event ${eventId}:`, err);
                return {
                    eventId,
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
                        const attributes = {
                            'attribute_Registrant Name': `${attendee.firstName} ${attendee.lastName}`,
                            'attribute_Registrant Meal Choice': attendee.mealChoice,
                            ...(attendee.dietaryRestrictions && {'attribute_Registrant Dietary Restrictions': attendee.dietaryRestrictions})
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
        // In a real implementation, this would redirect to Spektrix checkout
        alert('This would redirect to the Spektrix checkout process. Implementation depends on your specific Spektrix setup.');
    }

    function handleAddEventToBasket() {
        addTicketsToBasket();
    }
</script>

<div class="container mx-auto p-4 space-y-6 max-w-7xl">

    {#if loading && events.length === 0}
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
        <div class="grid gap-6 lg:grid-cols-3">
            <!-- Left Column: Events (2/3 width) -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Event cards with integrated attendee forms -->
                {#each events as event}
                    <EventCard
                            {event}
                            availability={availability[event.id]}
                            {selectedTickets}
                            {attendees}
                            {loading}
                            onticketselection={handleTicketSelection}
                            onattendeeupdate={handleAttendeeUpdate}
                            onaddtobasket={handleAddEventToBasket}
                    />
                {/each}
            </div>

            <!-- Right Column: Basket Summary (1/3 width) -->
            <div class="space-y-4">
                <BasketSummary
                        {basketItems}
                        {attendees}
                        advancementEventIds={SPEKTRIX_EVENT_IDS}
                        basketLoading={basketLoading}
                        onbasketupdated={handleBasketUpdated}
                        onproceedtocheckout={handleProceedToCheckout}
                />
            </div>
        </div>
    {/if}

    <!-- Toaster component for notifications -->
    <Toaster {toaster}/>
</div>
