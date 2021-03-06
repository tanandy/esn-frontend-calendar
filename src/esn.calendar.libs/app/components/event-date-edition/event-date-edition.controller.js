require('../../services/fc-moment.js');
require('../../services/event-utils.js');

'use strict';

angular.module('esn.calendar.libs')
  .controller('calEventDateEditionController', calEventDateEditionController);

function calEventDateEditionController(esnI18nDateFormatService, esnDatetimeService, esnI18nService, calMoment, calEventUtils, detectUtils) {
  var self = this;
  var previousStart;
  var previousEnd;
  var diff;

  self.$onInit = $onInit;
  self.dateOnBlurFn = dateOnBlurFn;
  self.getMinEndDate = getMinEndDate;
  self.onStartDateChange = onStartDateChange;
  self.onEndDateChange = onEndDateChange;
  self.onStartDateTimeChange = onStartDateTimeChange;
  self.onEndDateTimeChange = onEndDateTimeChange;
  self.allDayOnChange = allDayOnChange;

  function $onInit() {
    self.dateFormat = esnI18nDateFormatService.getLongDateFormat();
    self.disabled = self.disabled || false;
    self.full24HoursDay = self.event.full24HoursDay;
    self.locale = esnI18nService.getLocale();
    self.timeFormat = esnDatetimeService.getTimeFormat();
    self.isMobile = detectUtils.isMobile();
    self.start = calMoment(self.event.start).locale(self.locale);
    // In CalDAV backend, the end date of an all-day event is stored +1 day compared to the end date when a user saves the event.
    // Therefore, if this is an all-day event, we need to display -1 day for the end date input.
    self.end = !self.full24HoursDay ? calMoment(self.event.end).locale(self.locale) : calMoment(self.event.end).locale(self.locale).subtract(1, 'days');
    // Initialize the time inputs for the native mobile picker.
    _initMobileTimeInputs();
    // On load, ensure the duration between start and end is calculated
    _calcDateDiff();
    _updateMinEndDate();
  }

  function dateOnBlurFn() {
    // This is used to re-update views from the model in case the view is cleared
    self.start = self.start.clone();
    self.end = self.end.clone();
    if (angular.isFunction(self.dateOnBlur)) {
      self.dateOnBlur.apply(this, arguments);
    }
  }

  function getMinEndDate() {
    return self.start.clone().subtract(1, 'days').format('YYYY-MM-DD');
  }

  function allDayOnChange() {
    if (self.full24HoursDay) {
      _saveEventDateTime(self.start, self.end);

      // Strip time from moment object, make self.start & self.end timeless.
      self.start = esnDatetimeService.setAmbigTime(self.start, true);
      self.end = esnDatetimeService.setAmbigTime(self.end, true);
    // The user unchecks the 'All day' option after previously checking it.
    } else if (previousStart && previousEnd) {
      self.start = previousStart;
      self.end = previousEnd;

    // The user unchecks the 'All day' option after just opening an all-day event.
    } else {
      var nextHour = calMoment().startOf('hour').add(1, 'hour').hour();

      self.start = esnDatetimeService.setAmbigTime(self.start.clone().startOf('day').hour(nextHour), false);
      self.end = esnDatetimeService.setAmbigTime(_addDefaultEventDuration(self.end.clone().startOf('day').hour(nextHour)), false);
    }

    _checkAndForceEndAfterStart();
    _calcDateDiff();
    _syncEventDateTime();
    _onDateChange();
  }

  function onStartDateChange() {
    if (!self.start || !self.start.isValid()) {
      return;
    }

    // When 'All day' is selected, strip time
    if (self.full24HoursDay) {
      self.start = calEventUtils.stripTimeWithTz(self.start);
    }

    // Move the end range from the start range plus the offset
    self.end = calMoment(self.start).add(diff / 1000, 'seconds');
    _updateMinEndDate();
    _syncEventDateTime();
    _onDateChange();
    _initMobileTimeInputs();
  }

  function onStartDateTimeChange() {
    if (self.isMobile) {
      _setStartDateFromMobileInput();
    }
    // When we select a time we have to move the end time
    onStartDateChange();
  }

  function onEndDateChange() {
    if (!self.end || !self.end.isValid()) {
      return;
    }

    // When 'All day' is selected, strip time
    if (self.full24HoursDay) {
      self.end = calEventUtils.stripTimeWithTz(self.end);
    }

    _checkAndForceEndAfterStart();
    _syncEventDateTime();
    _calcDateDiff();
    _onDateChange();
    _initMobileTimeInputs();
  }

  function onEndDateTimeChange() {
    if (self.isMobile) {
      _setEndDateFromMobileInput();
    }

    _checkAndForceEndAfterStart();
    _calcDateDiff();
    _syncEventDateTime();
    _onDateChange();
    _initMobileTimeInputs();
  }

  function _saveEventDateTime(start, end) {
    previousStart = start.clone();
    previousEnd = end.clone();
  }

  function _syncEventDateTime() {
    if (self.full24HoursDay) {
      self.event.start = calEventUtils.stripTimeWithTz(self.start.clone());
      self.event.end = calEventUtils.stripTimeWithTz(self.end.clone().add(1, 'days'));

      return;
    }

    self.event.start = self.start.clone();
    self.event.end = self.end.clone();
  }

  function _addDefaultEventDuration(src) {
    return src.add(30, 'minutes'); // According to the default duration of an event
  }

  function _checkAndForceEndAfterStart() {
    if (self.full24HoursDay) return;

    // If the end of the event is the same or before the start, force the end
    if (self.end.isBefore(self.start) || self.end.isSame(self.start)) {
      self.end = _addDefaultEventDuration(self.start.clone());
    }
  }

  function _calcDateDiff() {
    diff = self.end.diff(self.start);
  }

  function _onDateChange() {
    self.onDateChange && self.onDateChange({
      start: self.start.clone(),
      end: self.end.clone()
    });
  }

  function _updateMinEndDate() {
    self.minEndDate = getMinEndDate();
  }

  function _initMobileTimeInputs() {
    self.startTime = self.start.toDate();
    self.endTime = self.end.toDate();

    // Due to differences between moment and the Date object we need to handle the hours differences.
    // The timezone has no meaning for Date object, the moment().toDate() converts the date to the browser timezone.
    // So the hours and minutes differ between the same moment date and the resulting date of .toDate() which is not wanted.
    self.startTime.setHours(self.start.hours());
    self.startTime.setMinutes(self.start.minutes());
    self.endTime.setHours(self.end.hours());
    self.endTime.setMinutes(self.end.minutes());
  }

  // When the date object gets modified by the native mobile picker we just get the hours and minutes
  // and set them back into the moment object, this has no impact on the timezone or whatsoever.
  function _setStartDateFromMobileInput() {
    self.start.set({
      hour: self.startTime.getHours(),
      minute: self.startTime.getMinutes()
    });
  }

  function _setEndDateFromMobileInput() {
    self.end.set({
      hour: self.endTime.getHours(),
      minute: self.endTime.getMinutes()
    });
  }
}
