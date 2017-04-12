import React from 'react';
import marked from 'marked';

import ApiMixin from '../../mixins/apiMixin';
import GroupStore from '../../stores/groupStore';
import IndicatorStore from '../../stores/indicatorStore';
import MemberListStore from '../../stores/memberListStore';
import {logException} from '../../utils/logging';
import localStorage from '../../utils/localStorage';
import {t} from '../../locale';

import {MentionsInput, Mention} from 'react-mentions';

import PureRenderMixin from 'react-addons-pure-render-mixin';
const localStorageKey = 'noteinput:latest';

function makeDefaultErrorJson() {
  return {detail: t('Unknown error. Please try again.')};
}

const NoteInput = React.createClass({
  propTypes: {
    item: React.PropTypes.object,
    group: React.PropTypes.object.isRequired,
    onFinish: React.PropTypes.func
  },

  mixins: [
    PureRenderMixin,
    ApiMixin
  ],

  getInitialState() {
    let {item, group} = this.props;
    let updating = !!item;
    let defaultText = '';

    if (updating) {
      defaultText = item.data.text;
    } else {
      let storage = localStorage.getItem(localStorageKey);
      if (storage) {
        let {groupId, value} = JSON.parse(storage);
        if (groupId === group.id) {
          defaultText = value;
        }
      }
    }

    return {
      loading: false,
      error: false,
      errorJSON: null,
      expanded: false,
      preview: false,
      updating: updating,
      value: defaultText,
      memberList: MemberListStore.getAll(),
      mentions: []
    };
  },

  componentWillUpdate(nextProps, nextState) {
    // We can't support this when editing an existing Note since it'll
    // clobber the other storages
    if (this.state.updating) return;

    // Nothing changed
    if (this.state.value === nextState.value) return;

    try {
      localStorage.setItem(localStorageKey, JSON.stringify({
        groupId: this.props.group.id,
        value: nextState.value
      }));
    } catch(ex) {
      logException(ex);
    }
  },

  toggleEdit() {
    this.setState({preview: false});
  },

  togglePreview() {
    this.setState({preview: true});
  },

  onSubmit(e) {
    e.preventDefault();
    this.submitForm();
  },

  submitForm() {
    this.setState({
      loading: true,
      error: false,
      errorJSON: null,
    });

    if (this.state.updating) {
      this.update();
    } else {
      this.create();
    }
  },

  create() {
    let {group} = this.props;

    let loadingIndicator = IndicatorStore.add(t('Posting comment..'));

    this.api.request('/issues/' + group.id + '/comments/', {
      method: 'POST',
      data: {
        text: this.state.value,
        mentions: this.state.mentions,
      },
      error: (error) => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson()
        });
      },
      success: (data) => {
        this.setState({
          value: '',
          preview: false,
          expanded: false,
          loading: false
        });
        GroupStore.addActivity(group.id, data);
        this.finish();
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  update() {
    let {group, item} = this.props;

    let loadingIndicator = IndicatorStore.add(t('Updating comment..'));

    this.api.request('/issues/' + group.id + '/comments/' + item.id + '/', {
      method: 'PUT',
      data: {
        text: this.state.value
      },
      error: (error) => {
        this.setState({
          loading: false,
          preview: false,
          error: true,
          errorJSON: error.responseJSON || makeDefaultErrorJson()
        });
        IndicatorStore.remove(loadingIndicator);
      },
      success: (data) => {
        this.setState({
          preview: false,
          expanded: false,
          loading: false
        });
        GroupStore.updateActivity(group.id, item.id, {text: this.state.value});
        IndicatorStore.remove(loadingIndicator);
        this.finish();
      }
    });
  },

  onChange(e) {
    this.setState({value: e.target.value});
  },

  onKeyDown(e) {
    // Auto submit the form on [meta] + Enter
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      this.submitForm();
    }
  },

  onCancel(e) {
    e.preventDefault();
    this.finish();
  },

  onAdd(id, display) {
    let mentions = this.state.mentions;
    this.setState({mentions: mentions.concat(id)});
  },

  finish() {
    this.props.onFinish && this.props.onFinish();
  },

  expand(e) {
    this.setState({expanded: true});

    // HACK: Move cursor to end of text after autoFocus
    // we do this my making sure this is only done on the first
    // onFocus event
    if (!this.state._hasFocused) {
      this.setState({_hasFocused: true});
      let value = e.target.value;
      e.target.value = '';
      e.target.value = value;
    }

  },

  maybeCollapse() {
    if (this.state.value === '') {
      this.setState({expanded: false});
    }
  },

  getMemberData() {
    return this.state.memberList.map((member) => {
      return {
        id: member.id,
        display: member.name,
        email: member.email
      };
    });
  },

  render() {
    let {error, errorJSON, loading, preview, updating, value} = this.state;
    let classNames = 'activity-field';
    if (error) {
      classNames += ' error';
    }
    if (loading) {
      classNames += ' loading';
    }

    let btnText = updating ? t('Save Comment') : t('Post Comment');
    let styles = {
        control: {
          backgroundColor: '#fff',

          fontSize: 12,
          fontWeight: 'normal',
        },

        input: {
          margin: 0,
        },

        '&singleLine': {
          control: {
            display: 'inline-block',

            width: 130,
          },

          highlighter: {
            padding: 1,
            border: '2px inset transparent',
          },

          input: {
            padding: 1,

            border: '2px inset',
          },
        },

        '&multiLine': {
          control: {
            fontFamily: 'Lato, Avenir Next, Helvetica Neue, sans-serif',

          },

          highlighter: {
            padding: 9,
          },

          input: {
            padding: 9,
            minHeight: 63,
            outline: 0,
            border: 0,
          },
        },

        suggestions: {
          list: {
            backgroundColor: 'white',
            border: '1px solid rgba(0,0,0,0.15)',
            fontSize: 12,
          },

          item: {
            padding: '5px 15px',
            borderBottom: '1px solid rgba(0,0,0,0.15)',

            '&focused': {
              backgroundColor: '#b9b2d0',
            },
          },
        },
      };

    return (
      <form className={classNames} onSubmit={this.onSubmit}>
        <div className="activity-notes">
          <ul className="nav nav-tabs">
            <li className={!preview ? 'active' : ''}>
              <a onClick={this.toggleEdit}>{updating ? t('Edit') : t('Write')}</a>
            </li>
            <li className={preview ? 'active' : ''}>
              <a onClick={this.togglePreview}>{t('Preview')}</a>
            </li>
            <li className="markdown">
              <span className="icon-markdown" /><span className="supported">
                {t('Markdown supported')}
              </span>
            </li>
          </ul>
          {preview ?
            <div className="note-preview"
                 dangerouslySetInnerHTML={{__html: marked(value)}} />
          :
            <MentionsInput style={styles} placeholder={t('Add details or updates to this event')}
                      onChange={this.onChange}
                      value={value}
                      displayTransform={ (display) => `@${display}` }
                      markup="**__display__**" >
                      <Mention trigger="@"
                          data={this.getMemberData()}
                          onAdd={this.onAdd} />
            </MentionsInput>
          }
          <div className="activity-actions">
            {errorJSON && errorJSON.detail &&
              <small className="error">{errorJSON.detail}</small>
            }
            <button className="btn btn-default" type="submit"
                    disabled={loading}>{btnText}</button>
            {updating &&
              <button className="btn btn-danger" onClick={this.onCancel}>{t('Cancel')}</button>}
          </div>
        </div>
      </form>
    );
  }
});

export default NoteInput;
