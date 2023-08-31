/**
 * @license
 * Copyright 2021 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Defines a version of the if block with dyanmic
 *     inputs that appear when a block is dragged over inputs on the block.
 */

import * as Blockly from 'blockly/core';

/** Type of a block that has the DYNAMIC_IF_MIXIN. */
type DynamicIfBlock = Blockly.Block & DynamicIfMixin;
/* eslint-disable @typescript-eslint/no-empty-interface */
/** This interface avoids a "circular reference" compile error. */
interface DynamicIfMixin extends DynamicIfMixinType {}
/* eslint-enable @typescript-eslint/no-empty-interface */
type DynamicIfMixinType = typeof DYNAMIC_IF_MIXIN;

interface CaseConnectionPair {
  ifTarget?: Blockly.Connection | null;
  doTarget?: Blockly.Connection | null;
}

interface CaseInputPair {
  ifInput: Blockly.Input;
  doInput: Blockly.Input;
}

/* eslint-disable @typescript-eslint/naming-convention */
const DYNAMIC_IF_MIXIN = {
  /** Minimum number of inputs for this block. */
  minInputs: 1,

  /** Count of else-if cases. */
  elseifCount: 0,

  /** Count of else cases (either 0 or 1). */
  elseCount: 0,

  /**
   * Block for if/elseif/else statements. Must have one if input.
   * Can have any number of elseif inputs and optionally one else input.
   */
  init(this: DynamicIfBlock): void {
    this.setHelpUrl(Blockly.Msg['CONTROLS_IF_HELPURL']);
    this.setStyle('logic_blocks');

    this.appendValueInput('IF0')
        .setCheck('Boolean')
        .appendField(Blockly.Msg['CONTROLS_IF_MSG_IF'], 'if');
    this.appendStatementInput('DO0')
        .appendField(Blockly.Msg['CONTROLS_IF_MSG_THEN']);

    this.setNextStatement(true);
    this.setPreviousStatement(true);
    this.setTooltip(Blockly.Msg['LISTS_CREATE_WITH_TOOLTIP']);
  },

  /**
   * Create XML to represent if/elseif/else inputs.
   * @returns XML storage element.
   */
  mutationToDom(this: DynamicIfBlock): Element|null {
    // If we call finalizeConnections here without disabling events, we get into
    // an event loop.
    Blockly.Events.disable();
    this.finalizeConnections();
    Blockly.Events.enable();

    if (!this.elseifCount && !this.elseCount) return null;

    const container = Blockly.utils.xml.createElement('mutation');
    if (this.elseifCount) {
      container.setAttribute('elseif', `${this.elseifCount}`);
    }
    if (this.elseCount) {
      container.setAttribute('else', '1');
    }
    return container;
  },

  /**
   * Parse XML to restore the inputs.
   * @param xmlElement XML storage element.
   */
  domToMutation(this: DynamicIfBlock, xmlElement: Element): void {
    if (xmlElement.getAttribute('inputs')) {
      this.deserializeInputs(xmlElement);
    } else {
      this.deserializeCounts(xmlElement);
    }
  },

  /**
   * Parses XML based on the 'inputs' attribute (non-standard).
   * @param xmlElement XML storage element.
   */
  deserializeInputs(this: DynamicIfBlock, xmlElement: Element): void {
    const inputs = xmlElement.getAttribute('inputs');
    if (inputs) {
      const inputNumbers = inputs.split(',');
      if (this.getInput('IF0')) {
        this.removeInput('IF0');
      }
      if (this.getInput('DO0')) {
        this.removeInput('DO0');
      }
      const first = inputNumbers[0];
      this.appendValueInput('IF' + first)
          .setCheck('Boolean')
          .appendField(Blockly.Msg['CONTROLS_IF_MSG_IF'], 'if');
      this.appendStatementInput('DO' + first)
          .appendField(Blockly.Msg['CONTROLS_IF_MSG_THEN']);

      for (let i = 1; i < inputNumbers.length; i++) {
        this.appendValueInput('IF' + inputNumbers[i])
            .setCheck('Boolean')
            .appendField(Blockly.Msg['CONTROLS_IF_MSG_ELSEIF'], 'elseif');
        this.appendStatementInput('DO' + inputNumbers[i])
            .appendField(Blockly.Msg['CONTROLS_IF_MSG_THEN']);
      }
    }
    const hasElse = xmlElement.getAttribute('else');
    if (hasElse == 'true') {
      this.appendStatementInput('ELSE')
          .appendField(Blockly.Msg['CONTROLS_IF_MSG_ELSE'], 'else');
    }
  },

  /**
   * Parses XML based on the 'elseif' and 'else' attributes (standard).
   * @param xmlElement XML storage element.
   */
  deserializeCounts(this: DynamicIfBlock, xmlElement: Element): void {
    this.elseifCount = parseInt(
        xmlElement.getAttribute('elseif') ?? '0', 10) || 0;
    this.elseCount = parseInt(xmlElement.getAttribute('else') ?? '0', 10) || 0;
    for (let i = 1; i <= this.elseifCount; i++) {
      this.appendValueInput('IF' + i).setCheck('Boolean').appendField(
          Blockly.Msg['CONTROLS_IF_MSG_ELSEIF']);
      this.appendStatementInput('DO' + i).appendField(
          Blockly.Msg['CONTROLS_IF_MSG_THEN']);
    }
    if (this.elseCount) {
      this.appendStatementInput('ELSE').appendField(
          Blockly.Msg['CONTROLS_IF_MSG_ELSE']);
    }
  },

  /**
   * Finds the index of a connection. Used to determine where in the block to
   * insert new inputs.
   * @param connection A connection on this block.
   * @returns The index of the connection in the this.inputList.
   */
  findInputIndexForConnection(
      this: DynamicIfBlock, connection: Blockly.Connection): number | null {
    for (let i = 0; i < this.inputList.length; i++) {
      const input = this.inputList[i];
      if (input.connection == connection) {
        return i;
      }
    }
    return null;
  },

  /**
   * Inserts a boolean value input and statement input at the specified index.
   * @param index Index of the input before which to add new inputs.
   * @param id An ID to append to the case statement input names to make them
   *     unique.
   * @returns The added inputs.
   */
  insertElseIf(
      this: DynamicIfBlock, index: number, id: string | number
  ): CaseInputPair {
    const ifInput = this.appendValueInput('IF' + id)
        .setCheck('Boolean')
        .appendField(Blockly.Msg['CONTROLS_IF_MSG_ELSEIF'], 'elseif');
    const doInput = this.appendStatementInput('DO' + id)
        .appendField(Blockly.Msg['CONTROLS_IF_MSG_THEN']);
    this.moveInputBefore('IF' + id, this.inputList[index].name);
    this.moveInputBefore('DO' + id, this.inputList[index + 1].name);
    return {ifInput, doInput};
  },

  /**
   * Called by a monkey-patched version of InsertionMarkerManager when
   * a block is dragged over one of the connections on this block.
   * @param connection The connection on this block that has a pending
   *     connection.
   */
  onPendingConnection(
      this: DynamicIfBlock, connection: Blockly.Connection): void {
    if (connection.type === Blockly.NEXT_STATEMENT && !this.getInput('ELSE')) {
      this.appendStatementInput('ELSE')
          .appendField(Blockly.Msg['CONTROLS_IF_MSG_ELSE'], 'else');
    }
    const inputIndex = this.findInputIndexForConnection(connection);
    if (inputIndex === null) {
      return;
    }
    const input = this.inputList[inputIndex];
    if (connection.targetConnection && input.name.includes('IF')) {
      const nextIfInput = this.inputList[inputIndex + 2];
      if (!nextIfInput || nextIfInput.name == 'ELSE') {
        this.insertElseIf(inputIndex + 2, Blockly.utils.idGenerator.genUid());
      } else {
        const nextIfConnection =
            nextIfInput &&
            nextIfInput.connection &&
            nextIfInput.connection.targetConnection;
        if (
          nextIfConnection &&
          !nextIfConnection.getSourceBlock().isInsertionMarker()
        ) {
          this.insertElseIf(inputIndex + 2, Blockly.utils.idGenerator.genUid());
        }
      }
    }
  },

  /**
   * Called by a monkey-patched version of InsertionMarkerManager when a block
   * drag ends if the dragged block had a pending connection with this block.
   */
  finalizeConnections(this: DynamicIfBlock): void {
    const targetCaseConns = this.collectTargetCaseConns();
    const targetElseConn = this.getInput('ELSE')?.connection?.targetConnection;

    this.deleteDynamicInputs();

    this.addCaseInputs(targetCaseConns);
    if (targetElseConn) this.addElseInput(targetElseConn);

    this.elseifCount = Math.max(targetCaseConns.length - 1, 0);
    this.elseCount = targetElseConn ? 1 : 0;
  },

  /**
   * Collects all of the target blocks attached to case inputs. If neither the
   * if nor the due input in a case has an attached block, that input is
   * skipped. If only one of them has an attached block, the other value in
   * the pair is undefined.
   * @returns  A list of target connections attached to case inputs.
   */
  collectTargetCaseConns(this: DynamicIfBlock): CaseConnectionPair[] {
    const targetConns = [];
    for (let i = 0; i < this.inputList.length - 1; i += 2) {
      const ifTarget =
          this.inputList[i].connection?.targetConnection;
      const doTarget =
          this.inputList[i + 1].connection?.targetConnection;
      if (!ifTarget && !doTarget) continue;
      targetConns.push({ifTarget, doTarget});
    }
    return targetConns;
  },

  /**
   * Deletes all of the inputs on this block except for the default "if"
   * and "do" inputs.
   */
  deleteDynamicInputs(this: DynamicIfBlock): void {
    for (let i = this.inputList.length - 1; i >= 2; i--) {
      this.removeInput(this.inputList[i].name);
    }
  },

  /**
   * Adds inputs for all of the given target connection pairs (if the input
   * doesn't already exist), and connects the target connections to them.
   *
   * This is essentially rebuilding all of the cases with strictly ascending
   * case numbers.
   * @param targetConns The list of target connections to attach to this block.
   */
  addCaseInputs(this: DynamicIfBlock, targetConns: CaseConnectionPair[]): void {
    for (let i = 0; i < targetConns.length; i++) {
      let ifInput = this.getInput(`IF${i}`);
      let doInput = this.getInput(`DO${i}`);
      if (!ifInput || !doInput) {
        ({ifInput, doInput} = this.insertElseIf(i * 2, i));
      }

      const {ifTarget, doTarget} = targetConns[i];
      if (ifTarget) ifInput.connection?.connect(ifTarget);
      if (doTarget) doInput.connection?.connect(doTarget);
    }
  },

  /**
   * Adds an else input to this block, and attaches the given connection to it.
   * @param targetElseConn The connection to connect to the new else input.
   */
  addElseInput(this: DynamicIfBlock, targetElseConn: Blockly.Connection): void {
    this.appendStatementInput('ELSE')
        .appendField(Blockly.Msg['CONTROLS_IF_MSG_ELSE'])
        .connection?.connect(targetElseConn);
  },
};

Blockly.Blocks['dynamic_if'] = DYNAMIC_IF_MIXIN;
