/**
 * Main script or build Contextly widget, using REST api.
 */
Contextly = Contextly || {};

Contextly.WPLogPluginEventType = {
    LOG: 'log'
};

Contextly.WPLogPluginEventName = {
    MODULE_VIEW: 'module_view'
};

Contextly.Settings = Contextly.createClass({
    extend: Contextly.BaseSettings,

    statics: {
        getAPIServerUrl: function () {
            return Contextly.api_server;
        },
        getMainServerUrl: function () {
            return Contextly.main_server;
        },
        getEditorUrl: function () {
            return Contextly.editor_url;
        },
        getAppId: function () {
            return Contextly.app_id;
        },
        getMode: function () {
            return Contextly.mode;
        },
        getWPSettings: function () {
            return Contextly.settings;
        },
        isHttps: function () {
            return Contextly.https;
        },
        getAjaxUrl: function () {
            return Contextly.ajax_url;
        },
        getAjaxNonce: function () {
            if ( Contextly.ajax_nonce ) {
                return Contextly.ajax_nonce;
            }
            return null;
        },
        isAdmin: function () {
            return Contextly.admin;
        },
        isBrandingDisplayed: function () {
            return !this.isAdmin();
        },
        getAssetUrl: function(path, ext) {
            if (this.getMode() == 'dev') {
                return Contextly.asset_url + '/' + path + '.' + ext;
            }
            else {
                return Contextly.BaseSettings.getAssetUrl.apply(this, arguments);
            }
        },
        getClientInfo: function() {
            return {
                client: 'wp',
                version: Contextly.version
            };
        },
        getKitVersion: function() {
            return Contextly.data.versions.kit;
        }

    }

});

Contextly.SettingsAutoLogin = Contextly.createClass({

	statics: {

		doLogin: function ( settings_button_id, disabled_flag ) {
            if ( disabled_flag )
            {
                jQuery( '#' + settings_button_id ).attr( 'disabled', 'disabled' );
            }

			jQuery.ajax({
				url: Contextly.Settings.getAjaxUrl(),
				type: 'post',
				dataType: 'json',
				data: {
					action: 'contextly_get_auth_token'
				},
				success: function ( response ) {
					if ( response.success && response.contextly_access_token ) {
                        if ( response.key_different_domain ) {
                            Contextly.WPAdminMessages.waring( "We believe this API key has been used on a staging or development site. " +
                                "If this is true, please do not reuse this API key. " +
                                "Please get a <a href='#' onclick='open_contextly_registration_page();'>new</a> API key for your new site. "
                            );
                        }

                        jQuery( '#' + settings_button_id ).attr( 'contextly_access_token', response.contextly_access_token );

                        if ( disabled_flag )
                        {
                            jQuery( '#' + settings_button_id ).removeAttr( 'disabled' );
                        }

                        Contextly.LogPluginEvents.fireEvent('contextlySettingsAuthSuccess', response);
					} else {
                        if ( response.message ) {
                            Contextly.WPAdminMessages.error( "You need a valid API key. Click the \"API Key\" tab above to get one." );
                        }

                        Contextly.LogPluginEvents.fireEvent('contextlySettingsAuthFailed', response);
                    }
				},
				error: function () {
					jQuery( '#' + settings_button_id ).removeAttr( 'disabled' );

                    Contextly.LogPluginEvents.fireEvent('contextlySettingsAuthFailed');
				}
			});
		}

	}

});

/**
 * @class
 */
Contextly.WPAdminMessages = Contextly.createClass({
    statics: {
        error: function ( message ) {
            this.render( 'error', message )
        },

        waring: function ( message ) {
            this.render( 'error', message )
        },

        render: function ( message_class, message_text ) {
            jQuery( '#contextly_warnings').html(
                "<div class='fade " + message_class + "'><p>" + message_text + "</p></div>"
            );
        }
    }
});

/**
 * @class
 * @extends Contextly.PageView
 */
Contextly.WPPageView = Contextly.createClass( /** @lends Contextly.PageView.prototype */ {

	extend: Contextly.PageView,

	statics: {

        loadWidgets: function() {
            // Fix problem for some clients with few our widgets on page
            // remove all occurrences and leave only one last
            if ( Contextly.Settings.getAppId() == 'asoundeffect' ) {
                var modules = jQuery("div[id='ctx-module']");
                if (modules.length > 1) {
                    var modules_count = modules.length;
                    modules.each(function (index, element) {
                        if (index != modules_count - 1) {
                            jQuery(element).remove();
                        }
                    });
                }
            }

            Contextly.PageView.loadWidgets.apply(this, arguments);
        },

		onWidgetsLoadingError: function(response) {
			Contextly.PageView.onWidgetsLoadingError.apply(this, arguments);
			if ( !Contextly.Settings.isAdmin() ) {
				return;
			}

			var message = '';
			if ( response.error ) {
				if ( response.error_code == Contextly.RESTClient.errors.FORBIDDEN ) {
					message = response.error + " Please check your API settings on the Contextly plugin <a href='admin.php?page=contextly_options&tab=contextly_options_api'>Settings</a> page.";
				} else if ( response.error_code == Contextly.RESTClient.errors.SUSPENDED ) {
					message = "Your account has been suspended. If this is an error, please contact us via <a href='http://contextly.com/contact-us/'>support@contextly.com</a>.";
				} else {
					message = "Please check your API settings on the Contextly plugin <a href='admin.php?page=contextly_options&tab=contextly_options_api'>Settings</a> page.";
				}
			} else {
				message = "Sorry, something seems to be broken. Please contact us via <a href='http://contextly.com/contact-us/'>support@contextly.com</a>.";
			}

			// TODO Render error without creating base widget.
			var widget = new Contextly.widget.Base();
			widget.displayHTML( message );
		},

		updatePostAction: function (response) {
            if (!response.entry.update) {
                return;
            }

            var args = arguments;
			var parentUpdate = this.proxy(function() {
				Contextly.PageView.updatePostAction.apply( this, args );
			});

			var data = {
				action: 'contextly_publish_post',
				page_id: Contextly.Settings.getPageId(),
				contextly_nonce: Contextly.Settings.getAjaxNonce()
			};

			jQuery.ajax({
				url: Contextly.ajax_url,
				type: 'post',
				dataType: 'json',
				data: data,
				success: function(response) {
					if ( response != true ) {
						parentUpdate();
					}
				},
				error: function () {
					parentUpdate();
				}
			});
		},

		afterDisplayWidgetAction: function ( e, widgetType, snippet ) {
            // TODO: Check this method

            if (widgetType !== Contextly.widget.types.SNIPPET) {
				return;
			}

			if (Contextly.Settings.isAdmin() || !snippet.hasWidgetData()) {
				return;
			}

			if (jQuery(this.getMainWidgetShortCodeId()).length) {
				if ( snippet.getDisplayElement().length ) {
                    snippet.getDisplayElement().appendTo( this.getMainWidgetShortCodeId() );
                } else {
                    jQuery( this.getMainWidgetShortCodeId() ).html( "<div id='ctx-module' class='ctx-module-container ctx-clearfix'></div>" );
                    snippet.display();
                }
			} else {
				// We need to be sure that our control is last in content element
				if (!snippet.getDisplayElement().is(":last-child")) {
                    snippet.getDisplayElement().parent().append(snippet.getDisplayElement());
				}
			}

            if (jQuery(this.getSLButtonShortCodeId()).length) {
                jQuery('#ctx-sl-subscribe')
                    .appendTo( this.getSLButtonShortCodeId() )
                    .removeClass( 'ctx_widget_hidden' );
            }
		},

		getMainWidgetShortCodeId: function () {
			return '#ctx_main_module_short_code';
		},

		getSLButtonShortCodeId: function () {
			return '#ctx_sl_button_short_code';
		}
/*\
        onWidgetsLoadingSuccess: function(response) {
            //Contextly.PageView.onWidgetsLoadingSuccess.apply(this, arguments);

            //if ( !Contextly.Settings.isAdmin() ) {
            //    this.attachModuleViewEvent();
            //}
            console.log(response);
        },

		attachModuleViewEvent: function () {
			var self = this;
			this.module_view_interval = window.setInterval(
				function () {
					var check_display_element = jQuery( '.ctx-section .ctx-link' ).first();
					if ( check_display_element.length ) {
						var is_visible = Contextly.WPUtils.isElementVisible( check_display_element );

						if ( is_visible ) {
							self.logModuleViewEvent();

							if ( self.module_view_interval ) {
								window.clearInterval( self.module_view_interval );
							}
						}
					}
				},
				300
			);
		},

		logModuleViewEvent: function () {
			if ( this.lastWidgetsResponse && this.lastWidgetsResponse.guid ) {
				Contextly.RESTClient.call(
					'events',
					'put',
					{
						event_type: Contextly.WPLogPluginEventType.LOG,
						event_name: Contextly.WPLogPluginEventName.MODULE_VIEW,
						event_guid: this.lastWidgetsResponse.guid
					}
				);
			}
		}
*/
	}
});

/**
 * @class
 * @extends Contextly.widget.Utils
 */
Contextly.WPUtils = Contextly.createClass({
    extend: Contextly.Utils,
    statics: {

        isElementVisible: function ( $el ) {
            var win = jQuery(window);
            var viewport = {
                top : win.scrollTop(),
                left : win.scrollLeft()
            };

            viewport.right = viewport.left + win.width();
            viewport.bottom = viewport.top + win.height();

            var bounds = $el.offset();
            bounds.right = bounds.left + $el.outerWidth();
            bounds.bottom = bounds.top + $el.outerHeight();

            return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));
        }

    }
});

if ( Contextly.Settings.getPageId() ) {
	Contextly.WPPageView.loadWidgets();
}
